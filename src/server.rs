use std::{convert::Infallible, path::PathBuf, sync::Arc};

use anyhow::{Context, Result};
use axum::{
    Json, Router,
    body::Body,
    extract::{Path, State},
    http::{
        HeaderMap, HeaderValue, StatusCode,
        header::{CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE, ORIGIN},
    },
    response::{
        IntoResponse, Response,
        sse::{Event, KeepAlive, Sse},
    },
    routing::{get, post},
};
use futures_util::StreamExt as FuturesStreamExt;
use rand::{RngExt, distr::Alphanumeric};
use serde::{Deserialize, Serialize};
use tokio::{
    net::TcpListener,
    sync::{Mutex, RwLock, oneshot},
};
use tokio_stream::wrappers::BroadcastStream;

use crate::{
    history::{History, HistoryRepository, MAX_HISTORY_LIMIT, RepoInfo, Revision},
    render::{FocusHistoryMode, RenderManager, RenderStatus},
};

#[derive(Clone)]
struct AppState {
    token: String,
    origin: String,
    repository: Arc<HistoryRepository>,
    history_start: String,
    history_paths: Vec<PathBuf>,
    history: Arc<RwLock<HistoryState>>,
    history_update: Arc<Mutex<()>>,
    render: Arc<RenderManager>,
}

struct HistoryState {
    limit: usize,
    history: History,
}

#[derive(Serialize)]
struct SessionResponse {
    repository: RepoInfo,
    target: crate::config::ResolvedTarget,
    compiler: String,
    history: SessionHistory,
    revisions: Vec<SessionRevision>,
}

#[derive(Clone, Serialize)]
struct SessionHistory {
    limit: usize,
    max_limit: usize,
    first_parent_keys: Vec<String>,
    full_tree_keys: Vec<String>,
}

#[derive(Serialize)]
struct SessionRevision {
    #[serde(flatten)]
    revision: Revision,
    render: Option<RenderStatus>,
}

#[derive(Deserialize)]
struct RenderRequest {
    revision_key: String,
}

#[derive(Deserialize)]
struct FocusRequest {
    revision_key: String,
    pinned_revision_key: String,
    history_mode: FocusHistoryMode,
    generation: u64,
}

#[derive(Deserialize)]
struct HistoryRequest {
    limit: usize,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn forbidden() -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: "invalid session capability".to_owned(),
        }
    }

    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn unavailable(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            [(CONTENT_TYPE, "application/json")],
            Json(serde_json::json!({ "error": self.message })),
        )
            .into_response()
    }
}

pub async fn serve(
    repository: Arc<HistoryRepository>,
    history_start: String,
    history: History,
    render: Arc<RenderManager>,
    limit: usize,
    open_browser: bool,
) -> Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .context("bind local viewer")?;
    let address = listener.local_addr().context("read viewer address")?;
    let token: String = rand::rng()
        .sample_iter(Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    let origin = format!("http://{address}");
    let url = format!("{origin}/{token}/");
    let history_paths = render.target().history_paths.clone();
    let state = AppState {
        token,
        origin,
        repository,
        history_start,
        history_paths,
        history: Arc::new(RwLock::new(HistoryState { limit, history })),
        history_update: Arc::new(Mutex::new(())),
        render,
    };
    let shutdown = state.render.shutdown_token();
    let render = Arc::clone(&state.render);

    let app = Router::new()
        .route("/{token}/", get(index))
        .route("/{token}/styles.css", get(styles))
        .route("/{token}/app.js", get(app_js))
        .route("/{token}/diff-worker.js", get(diff_worker))
        .route("/{token}/api/session", get(session))
        .route("/{token}/api/history", post(update_history))
        .route("/{token}/api/render", post(queue_render))
        .route("/{token}/api/focus", post(focus_render))
        .route("/{token}/api/events", get(events))
        .route(
            "/{token}/assets/{render_id}/page/{page_number}",
            get(page_asset),
        )
        .fallback(not_found)
        .with_state(state);

    let (signal_ready_tx, signal_ready_rx) = oneshot::channel();
    let signal_task = tokio::spawn(shutdown_signal(shutdown, signal_ready_tx));
    signal_ready_rx
        .await
        .context("shutdown signal task stopped during startup")?
        .context("install shutdown signal handler")?;

    println!("Typst Time Machine: {url}");
    if open_browser {
        open::that(&url).context("open browser")?;
    }
    let result = axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let _ = signal_task.await;
        })
        .await;
    render.shutdown().await;
    result.context("run local viewer")
}

async fn shutdown_signal(
    shutdown: tokio_util::sync::CancellationToken,
    ready: oneshot::Sender<std::io::Result<()>>,
) {
    #[cfg(unix)]
    let signal = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt());

    #[cfg(unix)]
    let mut signal = match signal {
        Ok(signal) => signal,
        Err(error) => {
            let _ = ready.send(Err(error));
            return;
        }
    };

    let _ = ready.send(Ok(()));

    #[cfg(unix)]
    let interrupted = signal.recv().await.is_some();

    #[cfg(not(unix))]
    let interrupted = tokio::signal::ctrl_c().await.is_ok();

    if interrupted {
        eprintln!("Shutting down…");
        shutdown.cancel();
    }
}

async fn index(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Response, ApiError> {
    check_token(&token, &state)?;
    static_response(
        include_str!("../web/index.html"),
        "text/html; charset=utf-8",
        true,
    )
}

async fn styles(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Response, ApiError> {
    check_token(&token, &state)?;
    static_response(
        include_str!("../web/styles.css"),
        "text/css; charset=utf-8",
        false,
    )
}

async fn app_js(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Response, ApiError> {
    check_token(&token, &state)?;
    static_response(
        include_str!("../web/dist/app.js"),
        "text/javascript; charset=utf-8",
        false,
    )
}

async fn diff_worker(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Response, ApiError> {
    check_token(&token, &state)?;
    static_response(
        include_str!("../web/dist/diff-worker.js"),
        "text/javascript; charset=utf-8",
        false,
    )
}

async fn session(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<SessionResponse>, ApiError> {
    check_token(&token, &state)?;
    Ok(Json(session_response(&state).await))
}

async fn session_response(state: &AppState) -> SessionResponse {
    let statuses = state.render.statuses().await;
    let current = state.history.read().await;
    SessionResponse {
        repository: state.repository.info.clone(),
        target: state.render.target().clone(),
        compiler: state.render.compiler_version().to_owned(),
        history: SessionHistory {
            limit: current.limit,
            max_limit: MAX_HISTORY_LIMIT,
            first_parent_keys: current.history.first_parent_keys.clone(),
            full_tree_keys: current.history.full_tree_keys.clone(),
        },
        revisions: current
            .history
            .revisions
            .iter()
            .cloned()
            .map(|revision| SessionRevision {
                render: statuses.get(&revision.key).cloned(),
                revision,
            })
            .collect(),
    }
}

async fn update_history(
    Path(token): Path<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<HistoryRequest>,
) -> Result<Json<SessionResponse>, ApiError> {
    check_token(&token, &state)?;
    check_origin(&headers, &state)?;
    if !(1..=MAX_HISTORY_LIMIT).contains(&request.limit) {
        return Err(ApiError::bad_request(format!(
            "history limit must be between 1 and {MAX_HISTORY_LIMIT}"
        )));
    }
    if state.render.shutdown_token().is_cancelled() {
        return Err(ApiError::unavailable("viewer is shutting down"));
    }

    let _update = state.history_update.lock().await;
    if state.render.shutdown_token().is_cancelled() {
        return Err(ApiError::unavailable("viewer is shutting down"));
    }
    let repository = Arc::clone(&state.repository);
    let history_start = state.history_start.clone();
    let history_paths = state.history_paths.clone();
    let limit = request.limit;
    let history = tokio::task::spawn_blocking(move || {
        repository.history(Some(&history_start), limit, &history_paths)
    })
    .await
    .map_err(|error| ApiError::unavailable(format!("history task failed: {error}")))?
    .map_err(|error| ApiError::unavailable(error.to_string()))?;
    if history.first_parent_keys.is_empty() {
        return Err(ApiError::bad_request(
            "no matching first-parent revisions found",
        ));
    }
    state
        .render
        .set_history(&history)
        .map_err(|error| ApiError::unavailable(error.to_string()))?;
    *state.history.write().await = HistoryState { limit, history };
    Ok(Json(session_response(&state).await))
}

async fn queue_render(
    Path(token): Path<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<RenderRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    check_token(&token, &state)?;
    check_origin(&headers, &state)?;
    if state.render.shutdown_token().is_cancelled() {
        return Err(ApiError::unavailable("viewer is shutting down"));
    }
    state
        .render
        .queue(&request.revision_key)
        .await
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(Json(serde_json::json!({ "queued": request.revision_key })))
}

async fn focus_render(
    Path(token): Path<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<FocusRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    check_token(&token, &state)?;
    check_origin(&headers, &state)?;
    if state.render.shutdown_token().is_cancelled() {
        return Err(ApiError::unavailable("viewer is shutting down"));
    }
    state
        .render
        .focus(
            &request.revision_key,
            &request.pinned_revision_key,
            request.history_mode,
            request.generation,
        )
        .await
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(Json(serde_json::json!({
        "focused": request.revision_key,
        "generation": request.generation
    })))
}

async fn events(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>, ApiError> {
    check_token(&token, &state)?;
    let shutdown = state.render.shutdown_token();
    let stream = tokio_stream::StreamExt::filter_map(
        BroadcastStream::new(state.render.subscribe()),
        |message| match message {
            Ok(event) => serde_json::to_string(&event)
                .ok()
                .map(|json| Ok(Event::default().event("render").data(json))),
            Err(_) => None,
        },
    );
    let stream = FuturesStreamExt::take_until(stream, shutdown.cancelled_owned());
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

async fn page_asset(
    Path((token, render_id, page_number)): Path<(String, String, usize)>,
    State(state): State<AppState>,
) -> Result<Response, ApiError> {
    check_token(&token, &state)?;
    let path = state
        .render
        .page_path(&render_id, page_number)
        .ok_or_else(|| ApiError {
            status: StatusCode::NOT_FOUND,
            message: "rendered page not found".to_owned(),
        })?;
    let bytes = tokio::fs::read(path).await.map_err(|_| ApiError {
        status: StatusCode::NOT_FOUND,
        message: "rendered page not found".to_owned(),
    })?;
    let mut response = Response::new(Body::from(bytes));
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("image/svg+xml"));
    response.headers_mut().insert(
        CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=31536000, immutable"),
    );
    response.headers_mut().insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    Ok(response)
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        [(CONTENT_TYPE, "text/plain; charset=utf-8")],
        "Not found",
    )
}

fn check_token(token: &str, state: &AppState) -> Result<(), ApiError> {
    if token == state.token {
        Ok(())
    } else {
        Err(ApiError::forbidden())
    }
}

fn check_origin(headers: &HeaderMap, state: &AppState) -> Result<(), ApiError> {
    let origin = headers
        .get(ORIGIN)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::forbidden)?;
    if origin == state.origin {
        Ok(())
    } else {
        Err(ApiError::forbidden())
    }
}

fn static_response(
    body: &'static str,
    content_type: &'static str,
    html: bool,
) -> Result<Response, ApiError> {
    let mut response = Response::new(Body::from(body));
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    response.headers_mut().insert(
        CACHE_CONTROL,
        HeaderValue::from_static(if html {
            "no-store, max-age=0"
        } else {
            "private, max-age=31536000, immutable"
        }),
    );
    response.headers_mut().insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    if html {
        response.headers_mut().insert(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(
                "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; worker-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
            ),
        );
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_required() {
        assert_eq!(StatusCode::FORBIDDEN, ApiError::forbidden().status);
    }
}
