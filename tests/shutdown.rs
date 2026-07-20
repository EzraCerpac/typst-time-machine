#![cfg(unix)]

use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::TcpStream,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

use tempfile::TempDir;

const SHUTDOWN_LIMIT: Duration = Duration::from_secs(1);
const TEST_DEADLINE: Duration = Duration::from_secs(15);

struct TestServer {
    child: Child,
    _workspace: TempDir,
    url: String,
    repository: PathBuf,
    cache: PathBuf,
    temporary: PathBuf,
    compiler: PathBuf,
    marker: PathBuf,
}

#[test]
fn ctrl_c_exits_without_browser_connection() {
    let mut server = TestServer::start(false);
    let elapsed = server.interrupt();
    assert!(
        elapsed < SHUTDOWN_LIMIT,
        "shutdown took {elapsed:?} without clients"
    );
}

#[test]
fn ctrl_c_closes_all_sse_connections() {
    let mut server = TestServer::start(false);
    let _clients = (0..3).map(|_| open_sse(&server.url)).collect::<Vec<_>>();

    let elapsed = server.interrupt();
    assert!(
        elapsed < SHUTDOWN_LIMIT,
        "shutdown took {elapsed:?} with SSE clients"
    );
}

#[test]
fn ctrl_c_cancels_compiler_and_cleans_staging() {
    let mut server = TestServer::start(true);
    wait_for_path(&server.marker);
    let compiler_pid: i32 = fs::read_to_string(&server.marker)
        .expect("read compiler pid")
        .trim()
        .parse()
        .expect("parse compiler pid");

    let elapsed = server.interrupt();
    assert!(
        elapsed < SHUTDOWN_LIMIT,
        "shutdown took {elapsed:?} during compilation"
    );
    assert!(
        !process_exists(compiler_pid),
        "compiler process {compiler_pid} survived shutdown"
    );
    assert!(
        !contains_named_file(&server.cache, "manifest.json"),
        "cancelled render published a cache manifest"
    );
    assert!(
        directory_is_empty(&server.temporary),
        "temporary render trees were not cleaned"
    );
}

#[test]
fn cache_hit_survives_shutdown_without_recompiling() {
    let mut server = TestServer::start(false);
    let manifest = wait_for_named_file(&server.cache, "manifest.json");
    let before = fs::read(&manifest).expect("read initial cache manifest");
    server.interrupt();

    server.restart(true);
    wait_for_ready_session(&server.url);
    assert!(
        !server.marker.exists(),
        "cache hit unexpectedly launched the compiler"
    );
    server.interrupt();

    assert_eq!(
        fs::read(&manifest).expect("read cache manifest after restart"),
        before,
        "shutdown modified a valid cache manifest"
    );
}

#[test]
fn history_limit_updates_pinned_session_and_render_catalog() {
    let mut server = TestServer::start(false);
    let pinned_head = git_text(&server.repository, &["rev-parse", "HEAD"]);

    fs::write(server.repository.join("main.typ"), "= Live head\n").expect("write live commit");
    git(&server.repository, &["add", "main.typ"]);
    git(
        &server.repository,
        &[
            "-c",
            "user.name=TTM Test",
            "-c",
            "user.email=ttm@example.invalid",
            "commit",
            "-qm",
            "live after startup",
        ],
    );
    let live_head = git_text(&server.repository, &["rev-parse", "HEAD"]);

    let response = http_post(&server.url, "api/history", r#"{"limit":3}"#, None);
    assert!(response.starts_with("HTTP/1.1 200"), "{response}");
    let session: serde_json::Value =
        serde_json::from_str(http_body(&response)).expect("parse updated session");
    assert_eq!(session["history"]["limit"], 3);
    assert_eq!(
        session["history"]["first_parent_keys"]
            .as_array()
            .expect("first-parent keys")
            .len(),
        3
    );
    let revisions = session["revisions"].as_array().expect("session revisions");
    assert!(
        revisions
            .iter()
            .any(|revision| revision["commit_id"] == pinned_head)
    );
    assert!(
        revisions
            .iter()
            .all(|revision| revision["commit_id"] != live_head)
    );

    let old_key = session["history"]["first_parent_keys"][2]
        .as_str()
        .expect("old revision key");
    let queue = http_post(
        &server.url,
        "api/render",
        &format!(r#"{{"revision_key":"{old_key}"}}"#),
        None,
    );
    assert!(queue.starts_with("HTTP/1.1 200"), "{queue}");
    wait_for_revision_ready(&server.url, old_key);

    let shrink = http_post(&server.url, "api/history", r#"{"limit":1}"#, None);
    assert!(shrink.starts_with("HTTP/1.1 200"), "{shrink}");
    let hidden_queue = http_post(
        &server.url,
        "api/render",
        &format!(r#"{{"revision_key":"{old_key}"}}"#),
        None,
    );
    assert!(hidden_queue.starts_with("HTTP/1.1 400"), "{hidden_queue}");

    assert!(
        http_post(&server.url, "api/history", r#"{"limit":0}"#, None).starts_with("HTTP/1.1 400")
    );
    assert!(
        http_post(
            &server.url,
            "api/history",
            r#"{"limit":2}"#,
            Some("http://wrong.invalid"),
        )
        .starts_with("HTTP/1.1 403")
    );
    server.interrupt();
}

impl TestServer {
    fn start(block_compile: bool) -> Self {
        let workspace = tempfile::tempdir().expect("create test workspace");
        let repository = workspace.path().join("repo");
        let cache = workspace.path().join("cache");
        let temporary = workspace.path().join("tmp");
        fs::create_dir_all(&repository).expect("create repository");
        fs::create_dir_all(&cache).expect("create cache");
        fs::create_dir_all(&temporary).expect("create temporary directory");
        fs::write(repository.join("main.typ"), "= Shutdown test\n").expect("write Typst source");
        git(&repository, &["init", "-q"]);
        git(&repository, &["add", "main.typ"]);
        git(
            &repository,
            &[
                "-c",
                "user.name=TTM Test",
                "-c",
                "user.email=ttm@example.invalid",
                "commit",
                "-qm",
                "initial",
            ],
        );
        for (source, message) in [
            ("= Shutdown test two\n", "second"),
            ("= Shutdown test three\n", "third"),
        ] {
            fs::write(repository.join("main.typ"), source).expect("write Typst source revision");
            git(&repository, &["add", "main.typ"]);
            git(
                &repository,
                &[
                    "-c",
                    "user.name=TTM Test",
                    "-c",
                    "user.email=ttm@example.invalid",
                    "commit",
                    "-qm",
                    message,
                ],
            );
        }

        let compiler = workspace.path().join("fake-typst");
        fs::write(
            &compiler,
            r#"#!/bin/sh
case "$1" in
  --version)
    echo "typst 0.15.0"
    exit 0
    ;;
  fonts)
    exit 0
    ;;
  compile)
    if [ "${TTM_TEST_BLOCK:-0}" = "1" ]; then
      echo "$$" > "$TTM_TEST_PID"
      exec /bin/sleep 60
    fi
    deps=""
    last=""
    while [ "$#" -gt 0 ]; do
      if [ "$1" = "--deps" ]; then
        shift
        deps="$1"
      fi
      last="$1"
      shift
    done
    printf '{"inputs":[]}\n' > "$deps"
    printf '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n' > "$(dirname "$last")/page-1-of-1.svg"
    exit 0
    ;;
esac
exit 2
"#,
        )
        .expect("write fake Typst compiler");
        let mut permissions = fs::metadata(&compiler)
            .expect("inspect fake compiler")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&compiler, permissions).expect("make fake compiler executable");

        let marker = workspace.path().join("compiler.pid");
        let (child, url) = spawn_ttm(
            &repository,
            &cache,
            &temporary,
            &compiler,
            &marker,
            block_compile,
        );

        Self {
            child,
            _workspace: workspace,
            url,
            repository,
            cache,
            temporary,
            compiler,
            marker,
        }
    }

    fn restart(&mut self, block_compile: bool) {
        if self.marker.exists() {
            fs::remove_file(&self.marker).expect("remove stale compiler marker");
        }
        let (child, url) = spawn_ttm(
            &self.repository,
            &self.cache,
            &self.temporary,
            &self.compiler,
            &self.marker,
            block_compile,
        );
        self.child = child;
        self.url = url;
    }

    fn interrupt(&mut self) -> Duration {
        let started = Instant::now();
        let result = unsafe { libc::kill(self.child.id() as i32, libc::SIGINT) };
        assert_eq!(result, 0, "send SIGINT to ttm");
        let status = wait_for_exit(&mut self.child);
        let elapsed = started.elapsed();
        if !status.success() {
            let mut diagnostics = String::new();
            if let Some(stderr) = self.child.stderr.as_mut() {
                let _ = stderr.read_to_string(&mut diagnostics);
            }
            panic!("ttm exited with {status}: {diagnostics}");
        }
        let mut diagnostics = String::new();
        if let Some(stderr) = self.child.stderr.as_mut() {
            stderr
                .read_to_string(&mut diagnostics)
                .expect("read ttm shutdown output");
        }
        assert!(
            diagnostics.contains("Shutting down…"),
            "missing shutdown message: {diagnostics}"
        );
        elapsed
    }
}

fn spawn_ttm(
    repository: &Path,
    cache: &Path,
    temporary: &Path,
    compiler: &Path,
    marker: &Path,
    block_compile: bool,
) -> (Child, String) {
    let mut command = Command::new(env!("CARGO_BIN_EXE_ttm"));
    command
        .current_dir(repository)
        .args([
            "view", "main.typ", "--vcs", "git", "--limit", "1", "--typst",
        ])
        .arg(compiler)
        .arg("--no-open")
        .env("XDG_CACHE_HOME", cache)
        .env("TMPDIR", temporary)
        .env("TTM_TEST_BLOCK", if block_compile { "1" } else { "0" })
        .env("TTM_TEST_PID", marker)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().expect("start ttm");
    let stdout = child.stdout.take().expect("capture ttm stdout");
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let line = BufReader::new(stdout)
            .lines()
            .next()
            .transpose()
            .map_err(|error| error.to_string())
            .and_then(|line| line.ok_or_else(|| "ttm exited before printing its URL".to_owned()));
        let _ = sender.send(line);
    });
    let line = match receiver
        .recv_timeout(TEST_DEADLINE)
        .expect("timed out waiting for ttm URL")
    {
        Ok(line) => line,
        Err(error) => {
            let _ = child.wait();
            let mut diagnostics = String::new();
            if let Some(stderr) = child.stderr.as_mut() {
                let _ = stderr.read_to_string(&mut diagnostics);
            }
            panic!("read ttm URL: {error}: {diagnostics}");
        }
    };
    let url = line
        .strip_prefix("Typst Time Machine: ")
        .expect("unexpected ttm startup output")
        .to_owned();
    (child, url)
}

impl Drop for TestServer {
    fn drop(&mut self) {
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

fn git(repository: &Path, args: &[&str]) {
    let status = Command::new("git")
        .current_dir(repository)
        .args(args)
        .status()
        .expect("run git");
    assert!(status.success(), "git {args:?} failed");
}

fn open_sse(url: &str) -> TcpStream {
    let target = url.strip_prefix("http://").expect("ttm URL uses HTTP");
    let (authority, token) = target.split_once('/').expect("ttm URL has a token");
    let path = format!("/{}/api/events", token.trim_end_matches('/'));
    let mut stream = TcpStream::connect(authority).expect("connect SSE client");
    stream
        .set_read_timeout(Some(TEST_DEADLINE))
        .expect("set SSE read timeout");
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: {authority}\r\nAccept: text/event-stream\r\nConnection: keep-alive\r\n\r\n"
    )
    .expect("send SSE request");
    stream.flush().expect("flush SSE request");

    let mut response = Vec::new();
    let mut buffer = [0_u8; 512];
    while !response.windows(4).any(|window| window == b"\r\n\r\n") {
        let read = stream.read(&mut buffer).expect("read SSE response");
        assert!(read > 0, "SSE connection closed before response headers");
        response.extend_from_slice(&buffer[..read]);
    }
    assert!(
        response.starts_with(b"HTTP/1.1 200"),
        "unexpected SSE response: {}",
        String::from_utf8_lossy(&response)
    );
    stream
}

fn wait_for_exit(child: &mut Child) -> std::process::ExitStatus {
    let deadline = Instant::now() + TEST_DEADLINE;
    loop {
        if let Some(status) = child.try_wait().expect("poll ttm") {
            return status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let status = child.wait().expect("reap timed-out ttm");
            panic!("ttm did not exit after SIGINT; forced status {status}");
        }
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_path(path: &Path) {
    let deadline = Instant::now() + TEST_DEADLINE;
    while !path.exists() {
        assert!(
            Instant::now() < deadline,
            "timed out waiting for {}",
            path.display()
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_named_file(root: &Path, name: &str) -> PathBuf {
    let deadline = Instant::now() + TEST_DEADLINE;
    loop {
        if let Some(path) = find_named_file(root, name) {
            return path;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for {name} under {}",
            root.display()
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_ready_session(url: &str) {
    let deadline = Instant::now() + TEST_DEADLINE;
    loop {
        if http_get(url, "api/session").contains("\"phase\":\"ready\"") {
            return;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for cached render"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_revision_ready(url: &str, revision_key: &str) {
    let deadline = Instant::now() + TEST_DEADLINE;
    loop {
        let response = http_get(url, "api/session");
        let session: serde_json::Value =
            serde_json::from_str(http_body(&response)).expect("parse session");
        if session["revisions"]
            .as_array()
            .expect("session revisions")
            .iter()
            .any(|revision| {
                revision["key"] == revision_key && revision["render"]["phase"] == "ready"
            })
        {
            return;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for revision {revision_key}"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn http_get(url: &str, suffix: &str) -> String {
    let target = url.strip_prefix("http://").expect("ttm URL uses HTTP");
    let (authority, token) = target.split_once('/').expect("ttm URL has a token");
    let path = format!("/{}/{}", token.trim_end_matches('/'), suffix);
    let mut stream = TcpStream::connect(authority).expect("connect HTTP client");
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: {authority}\r\nConnection: close\r\n\r\n"
    )
    .expect("send HTTP request");
    stream.flush().expect("flush HTTP request");
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .expect("read HTTP response");
    response
}

fn http_post(url: &str, suffix: &str, body: &str, origin: Option<&str>) -> String {
    let target = url.strip_prefix("http://").expect("ttm URL uses HTTP");
    let (authority, token) = target.split_once('/').expect("ttm URL has a token");
    let path = format!("/{}/{}", token.trim_end_matches('/'), suffix);
    let origin = origin
        .map(str::to_owned)
        .unwrap_or_else(|| format!("http://{authority}"));
    let mut stream = TcpStream::connect(authority).expect("connect HTTP client");
    write!(
        stream,
        "POST {path} HTTP/1.1\r\nHost: {authority}\r\nOrigin: {origin}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len(),
    )
    .expect("send HTTP request");
    stream.flush().expect("flush HTTP request");
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .expect("read HTTP response");
    response
}

fn http_body(response: &str) -> &str {
    response
        .split_once("\r\n\r\n")
        .map(|(_, body)| body)
        .expect("HTTP response has body")
}

fn git_text(repository: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .current_dir(repository)
        .args(args)
        .output()
        .expect("run git");
    assert!(output.status.success(), "git {args:?} failed");
    String::from_utf8(output.stdout)
        .expect("Git returned UTF-8")
        .trim()
        .to_owned()
}

fn process_exists(pid: i32) -> bool {
    unsafe { libc::kill(pid, 0) == 0 }
}

fn contains_named_file(root: &Path, name: &str) -> bool {
    find_named_file(root, name).is_some()
}

fn find_named_file(root: &Path, name: &str) -> Option<PathBuf> {
    root.exists().then_some(())?;
    walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(Result::ok)
        .find(|entry| entry.file_type().is_file() && entry.file_name() == name)
        .map(|entry| entry.into_path())
}

fn directory_is_empty(root: &Path) -> bool {
    fs::read_dir(root)
        .expect("read temporary directory")
        .next()
        .is_none()
}
