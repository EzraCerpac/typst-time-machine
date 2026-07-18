use std::{
    cmp::Ordering,
    collections::{BinaryHeap, HashMap, HashSet},
    fs,
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::{Command, ExitStatus, Output, Stdio},
    sync::{Arc, RwLock as StdRwLock},
};

use anyhow::{Context, Result, bail};
use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tempfile::Builder;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter},
    process::{Child, ChildStdin, ChildStdout},
    runtime::Handle,
    sync::{Mutex, RwLock, broadcast, mpsc},
};
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use crate::{
    config::ResolvedTarget,
    engine::{EMBEDDED_TYPST_VERSION, EngineConfig, EnginePage, EngineReply, EngineRequest},
    history::{HistoryRepository, Revision},
};

const CACHE_VERSION: u32 = 2;
const MAX_RETAINED_ENGINE_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RenderPhase {
    Queued,
    Materializing,
    Compiling,
    Ready,
    EntrypointMissing,
    Error,
}

#[derive(Clone, Debug, Serialize)]
pub struct RenderStatus {
    pub revision_key: String,
    pub phase: RenderPhase,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub render_id: Option<String>,
    #[serde(default)]
    pub pages: Vec<PageArtifact>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PageArtifact {
    pub number: usize,
    pub file: String,
    pub hash: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CacheManifest {
    pub version: u32,
    pub render_id: String,
    pub revision_key: String,
    pub compiler: String,
    pub entry: PathBuf,
    pub root: PathBuf,
    pub dependencies: Vec<String>,
    pub pages: Vec<PageArtifact>,
}

#[derive(Clone, Debug, Serialize)]
pub struct RenderEvent {
    pub status: RenderStatus,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FocusHistoryMode {
    FirstParent,
    FullTree,
}

enum ScheduleCommand {
    Queue(String),
    Focus {
        selected: String,
        pinned: String,
        history_mode: FocusHistoryMode,
        generation: u64,
    },
}

#[derive(Eq)]
struct Scheduled {
    priority: u16,
    order: u64,
    key: String,
}

impl Ord for Scheduled {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority
            .cmp(&other.priority)
            .then_with(|| other.order.cmp(&self.order))
    }
}

impl PartialOrd for Scheduled {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl PartialEq for Scheduled {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority && self.order == other.order && self.key == other.key
    }
}

pub struct RenderManager {
    repository: Arc<HistoryRepository>,
    target: ResolvedTarget,
    revisions: HashMap<String, Revision>,
    first_parent_keys: Vec<String>,
    full_tree_keys: Vec<String>,
    cache_root: PathBuf,
    compiler_version: String,
    font_fingerprint: StdRwLock<Option<String>>,
    statuses: RwLock<HashMap<String, RenderStatus>>,
    artifacts: StdRwLock<HashMap<String, Vec<PageArtifact>>>,
    events: broadcast::Sender<RenderEvent>,
    shutdown: CancellationToken,
    tasks: TaskTracker,
    schedule: mpsc::UnboundedSender<ScheduleCommand>,
    workers: [WorkerSlot; 2],
}

struct WorkerSlot {
    client: Mutex<Option<WorkerClient>>,
}

enum RenderOutcome {
    Ready(CacheManifest),
    EntrypointMissing(String),
    Cancelled,
}

enum CompileOutcome {
    Finished(Output),
    Cancelled,
}

impl RenderManager {
    pub fn new(
        repository: Arc<HistoryRepository>,
        target: ResolvedTarget,
        revisions: &[Revision],
        first_parent_keys: &[String],
        full_tree_keys: &[String],
    ) -> Result<Arc<Self>> {
        let cache_root = cache_root()?;
        fs::create_dir_all(cache_root.join("renders"))
            .context("create Typst Time Machine render cache")?;
        fs::create_dir_all(cache_root.join("blobs/svg"))
            .context("create Typst Time Machine page cache")?;
        let (compiler_version, font_fingerprint) = if target.typst.is_some() {
            (probe_typst(&target)?, Some(probe_external_fonts(&target)))
        } else {
            (format!("embedded Typst {EMBEDDED_TYPST_VERSION}"), None)
        };
        let (events, _) = broadcast::channel(256);
        let (schedule, receiver) = mpsc::unbounded_channel();
        let manager = Arc::new(Self {
            repository,
            target,
            revisions: revisions
                .iter()
                .cloned()
                .map(|revision| (revision.key.clone(), revision))
                .collect(),
            first_parent_keys: first_parent_keys.to_vec(),
            full_tree_keys: full_tree_keys.to_vec(),
            cache_root,
            compiler_version,
            font_fingerprint: StdRwLock::new(font_fingerprint),
            statuses: RwLock::new(HashMap::new()),
            artifacts: StdRwLock::new(HashMap::new()),
            events,
            shutdown: CancellationToken::new(),
            tasks: TaskTracker::new(),
            schedule,
            workers: [
                WorkerSlot {
                    client: Mutex::new(None),
                },
                WorkerSlot {
                    client: Mutex::new(None),
                },
            ],
        });
        let scheduler = Arc::clone(&manager);
        manager.tasks.spawn(async move {
            scheduler.run_scheduler(receiver).await;
        });
        Ok(manager)
    }

    pub fn compiler_version(&self) -> &str {
        &self.compiler_version
    }

    pub fn target(&self) -> &ResolvedTarget {
        &self.target
    }

    pub fn subscribe(&self) -> broadcast::Receiver<RenderEvent> {
        self.events.subscribe()
    }

    pub fn shutdown_token(&self) -> CancellationToken {
        self.shutdown.clone()
    }

    pub async fn shutdown(&self) {
        self.shutdown.cancel();
        self.tasks.close();
        self.tasks.wait().await;
        for worker in &self.workers {
            if let Some(mut client) = worker.client.lock().await.take() {
                client.stop().await;
            }
        }
    }

    pub async fn statuses(&self) -> HashMap<String, RenderStatus> {
        self.statuses.read().await.clone()
    }

    pub async fn queue(&self, revision_key: &str) -> Result<()> {
        self.validate_revision(revision_key)?;
        self.schedule
            .send(ScheduleCommand::Queue(revision_key.to_owned()))
            .map_err(|_| anyhow::anyhow!("render scheduler is unavailable"))
    }

    pub async fn focus(
        &self,
        selected: &str,
        pinned: &str,
        history_mode: FocusHistoryMode,
        generation: u64,
    ) -> Result<()> {
        self.validate_revision(selected)?;
        self.validate_revision(pinned)?;
        self.schedule
            .send(ScheduleCommand::Focus {
                selected: selected.to_owned(),
                pinned: pinned.to_owned(),
                history_mode,
                generation,
            })
            .map_err(|_| anyhow::anyhow!("render scheduler is unavailable"))
    }

    fn validate_revision(&self, revision_key: &str) -> Result<()> {
        if self.shutdown.is_cancelled() {
            bail!("viewer is shutting down");
        }
        if !self.revisions.contains_key(revision_key) {
            bail!("unknown revision key");
        }
        Ok(())
    }

    async fn run_scheduler(
        self: Arc<Self>,
        mut receiver: mpsc::UnboundedReceiver<ScheduleCommand>,
    ) {
        let (finished_tx, mut finished_rx) = mpsc::unbounded_channel::<String>();
        let mut heap = BinaryHeap::new();
        let mut active = HashSet::new();
        let mut order = 0_u64;
        let mut previous_focus: Option<String> = None;
        let mut latest_generation = 0_u64;
        let mut idle_tick = tokio::time::interval(std::time::Duration::from_secs(30));

        loop {
            tokio::select! {
                _ = self.shutdown.cancelled() => break,
                _ = idle_tick.tick() => {
                    if heap.is_empty()
                        && active.is_empty()
                        && let Some(mut client) = self.workers[1].client.lock().await.take()
                    {
                        client.stop().await;
                    }
                }
                Some(key) = finished_rx.recv() => {
                    active.remove(&key);
                }
                Some(command) = receiver.recv() => {
                    match command {
                        ScheduleCommand::Queue(key) => {
                            order += 1;
                            heap.push(Scheduled { priority: 950, order, key });
                        }
                        ScheduleCommand::Focus { selected, pinned, history_mode, generation } => {
                            if generation < latest_generation {
                                continue;
                            }
                            latest_generation = generation;
                            let keys = match history_mode {
                                FocusHistoryMode::FirstParent => &self.first_parent_keys,
                                FocusHistoryMode::FullTree => &self.full_tree_keys,
                            };
                            let selected_position = keys.iter().position(|key| key == &selected);
                            let previous_position = previous_focus
                                .as_ref()
                                .and_then(|previous| keys.iter().position(|key| key == previous));
                            let direction = match (selected_position, previous_position) {
                                (Some(current), Some(previous)) => current.cmp(&previous),
                                _ => Ordering::Equal,
                            };
                            previous_focus = Some(selected.clone());
                            heap.clear();
                            let mut queued = HashSet::new();
                            push_job(&mut heap, &mut queued, &mut order, selected.clone(), 1000);
                            push_job(&mut heap, &mut queued, &mut order, pinned, 940);
                            if let Some(position) = selected_position {
                                let offsets: [isize; 4] = match direction {
                                    Ordering::Less => [-1, -2, 1, 2],
                                    Ordering::Greater => [1, 2, -1, -2],
                                    Ordering::Equal => [-1, 1, -2, 2],
                                };
                                for (rank, offset) in offsets.into_iter().enumerate() {
                                    let neighbor = position as isize + offset;
                                    if neighbor >= 0
                                        && let Some(key) = keys.get(neighbor as usize)
                                    {
                                        push_job(
                                            &mut heap,
                                            &mut queued,
                                            &mut order,
                                            key.clone(),
                                            900 - rank as u16,
                                        );
                                    }
                                }
                            }
                            for key in keys {
                                push_job(&mut heap, &mut queued, &mut order, key.clone(), 100);
                            }
                            if matches!(history_mode, FocusHistoryMode::FirstParent) {
                                for key in &self.full_tree_keys {
                                    push_job(&mut heap, &mut queued, &mut order, key.clone(), 10);
                                }
                            }
                            let queued_keys =
                                heap.iter().map(|job| job.key.clone()).collect::<Vec<_>>();
                            for key in queued_keys {
                                if !active.contains(&key) && !self.is_rendering_or_ready(&key).await {
                                    self.set_phase(&key, RenderPhase::Queued, None).await;
                                }
                            }
                        }
                    }
                }
                else => break,
            }

            while active.len() < 2 {
                let Some(job) = heap.pop() else {
                    break;
                };
                if active.contains(&job.key) || self.is_rendering_or_ready(&job.key).await {
                    continue;
                }
                active.insert(job.key.clone());
                self.set_phase(&job.key, RenderPhase::Queued, None).await;
                let worker_index = if job.priority >= 900 { 0 } else { 1 };
                let manager = Arc::clone(&self);
                let key = job.key.clone();
                let finished = finished_tx.clone();
                self.tasks.spawn(async move {
                    manager.render_revision(&key, worker_index).await;
                    let _ = finished.send(key);
                });
            }
        }
    }

    async fn is_rendering_or_ready(&self, key: &str) -> bool {
        matches!(
            self.statuses
                .read()
                .await
                .get(key)
                .map(|status| &status.phase),
            Some(RenderPhase::Materializing | RenderPhase::Compiling | RenderPhase::Ready)
        )
    }

    async fn render_revision(self: &Arc<Self>, key: &str, worker_index: usize) {
        if self.shutdown.is_cancelled() {
            return;
        }
        if self.target.typst.is_none()
            && let Err(error) = self.ensure_embedded_worker(worker_index).await
        {
            if !self.shutdown.is_cancelled() {
                self.set_phase(key, RenderPhase::Error, Some(format!("{error:#}")))
                    .await;
            }
            return;
        }
        let cache_manager = Arc::clone(self);
        let cache_key = key.to_owned();
        let cached =
            tokio::task::spawn_blocking(move || cache_manager.cached_revision(&cache_key)).await;
        match cached {
            Ok(Ok(Some(manifest))) => {
                self.set_ready(key, manifest).await;
                return;
            }
            Ok(Ok(None)) => {}
            Ok(Err(error)) => {
                self.set_phase(key, RenderPhase::Error, Some(format!("{error:#}")))
                    .await;
                return;
            }
            Err(error) => {
                self.set_phase(
                    key,
                    RenderPhase::Error,
                    Some(format!("cache task failed: {error}")),
                )
                .await;
                return;
            }
        }

        let result = if self.target.typst.is_some() {
            self.set_phase(key, RenderPhase::Materializing, None).await;
            let manager = Arc::clone(self);
            let key = key.to_owned();
            let cancellation = self.shutdown.clone();
            let runtime = Handle::current();
            tokio::task::spawn_blocking(move || {
                manager.render_external_sync(&key, &cancellation, &runtime)
            })
            .await
            .map_err(anyhow::Error::from)
            .and_then(|result| result)
        } else {
            self.set_phase(key, RenderPhase::Compiling, None).await;
            self.render_embedded(key, worker_index).await
        };

        match result {
            Ok(RenderOutcome::Ready(manifest)) => self.set_ready(key, manifest).await,
            Ok(RenderOutcome::EntrypointMissing(message)) => {
                self.set_phase(key, RenderPhase::EntrypointMissing, Some(message))
                    .await;
            }
            Ok(RenderOutcome::Cancelled) => {}
            Err(error) if !self.shutdown.is_cancelled() => {
                self.set_phase(key, RenderPhase::Error, Some(format!("{error:#}")))
                    .await;
            }
            Err(_) => {}
        }
    }

    async fn render_embedded(&self, key: &str, worker_index: usize) -> Result<RenderOutcome> {
        let revision = self
            .revisions
            .get(key)
            .with_context(|| format!("unknown revision {key}"))?;
        let staging = Builder::new()
            .prefix("ttm-render-")
            .tempdir_in(self.cache_root.join("renders"))
            .context("create render staging directory")?;
        let config = self.engine_config();
        let request = EngineRequest::Compile {
            commit_id: revision.commit_id.clone(),
            committer_unix: revision.committer_unix,
            staging: staging.path().to_path_buf(),
        };

        let mut slot = self.workers[worker_index].client.lock().await;
        let reply = run_worker_request(&mut slot, &config, request, &self.shutdown).await?;
        let retained_bytes = match &reply {
            EngineReply::Ready { retained_bytes, .. }
            | EngineReply::Compiled { retained_bytes, .. }
            | EngineReply::EntrypointMissing { retained_bytes, .. }
            | EngineReply::Error { retained_bytes, .. } => *retained_bytes,
        };
        if retained_bytes > MAX_RETAINED_ENGINE_BYTES
            && let Some(mut client) = slot.take()
        {
            client.stop().await;
        }
        drop(slot);

        match reply {
            EngineReply::Compiled {
                pages,
                dependencies,
                ..
            } => {
                let manifest =
                    self.publish_embedded_pages(revision, staging.path(), pages, dependencies)?;
                Ok(RenderOutcome::Ready(manifest))
            }
            EngineReply::EntrypointMissing { message, .. } => {
                Ok(RenderOutcome::EntrypointMissing(message))
            }
            EngineReply::Error { message, .. } => bail!("Typst compilation failed\n{message}"),
            EngineReply::Ready { .. } => bail!("embedded compiler returned an unexpected reply"),
        }
    }

    fn engine_config(&self) -> EngineConfig {
        EngineConfig {
            git_dir: self.repository.git_dir().to_path_buf(),
            entry: self.target.entry.clone(),
            root: self.target.root.clone(),
            inputs: self.target.inputs.clone(),
            font_paths: self.target.font_paths.clone(),
            package_path: self.target.package_path.clone(),
            package_cache_path: self.target.package_cache_path.clone(),
        }
    }

    async fn ensure_embedded_worker(&self, worker_index: usize) -> Result<()> {
        let mut slot = self.workers[worker_index].client.lock().await;
        if slot.is_none() {
            let client = WorkerClient::start(&self.engine_config(), &self.shutdown).await?;
            {
                let mut fingerprint = self
                    .font_fingerprint
                    .write()
                    .expect("font fingerprint lock poisoned");
                match fingerprint.as_ref() {
                    Some(current) if current != &client.font_fingerprint => {
                        bail!("Typst workers reported different font inventories");
                    }
                    Some(_) => {}
                    None => *fingerprint = Some(client.font_fingerprint.clone()),
                }
            }
            *slot = Some(client);
        }
        Ok(())
    }

    fn render_external_sync(
        &self,
        revision_key: &str,
        cancellation: &CancellationToken,
        runtime: &Handle,
    ) -> Result<RenderOutcome> {
        if cancellation.is_cancelled() {
            return Ok(RenderOutcome::Cancelled);
        }
        let revision = self
            .revisions
            .get(revision_key)
            .with_context(|| format!("unknown revision {revision_key}"))?;
        let staging = Builder::new()
            .prefix("ttm-render-")
            .tempdir_in(self.cache_root.join("renders"))
            .context("create render staging directory")?;
        let snapshot_parent = Builder::new()
            .prefix("ttm-tree-")
            .tempdir()
            .context("create revision staging directory")?;
        let snapshot = snapshot_parent.path().join("tree");
        let materialized = self.repository.materialize(revision, &snapshot)?;
        if cancellation.is_cancelled() {
            return Ok(RenderOutcome::Cancelled);
        }
        self.set_sync_phase(revision_key, RenderPhase::Compiling, None);
        let entry = snapshot.join(&self.target.entry);
        let metadata = match fs::symlink_metadata(&entry) {
            Ok(metadata) => metadata,
            Err(_) => {
                return Ok(RenderOutcome::EntrypointMissing(format!(
                    "{} does not exist in {}",
                    self.target.entry.display(),
                    &revision.commit_id[..revision.commit_id.len().min(12)]
                )));
            }
        };
        if !metadata.file_type().is_file() && !metadata.file_type().is_symlink() {
            return Ok(RenderOutcome::EntrypointMissing(format!(
                "{} is not a Typst file in this revision",
                self.target.entry.display()
            )));
        }

        let project_root = snapshot.join(&self.target.root);
        let deps_path = staging.path().join("deps.json");
        let output_pattern = staging.path().join("page-{0p}-of-{t}.svg");
        let typst = self
            .target
            .typst
            .as_ref()
            .context("external compiler path is missing")?;
        let mut command = Command::new(typst);
        command
            .args(["compile", "--format", "svg", "--root"])
            .arg(&project_root)
            .arg("--creation-timestamp")
            .arg(revision.committer_unix.to_string())
            .arg("--deps")
            .arg(&deps_path);
        for (key, value) in &self.target.inputs {
            command.arg("--input").arg(format!("{key}={value}"));
        }
        for font_path in &self.target.font_paths {
            command.arg("--font-path").arg(font_path);
        }
        if let Some(package_path) = &self.target.package_path {
            command.arg("--package-path").arg(package_path);
        }
        if let Some(package_cache_path) = &self.target.package_cache_path {
            command.arg("--package-cache-path").arg(package_cache_path);
        }
        command.arg(&entry).arg(&output_pattern);

        let output = match runtime.block_on(run_compiler(command, cancellation.clone()))? {
            CompileOutcome::Finished(output) => output,
            CompileOutcome::Cancelled => return Ok(RenderOutcome::Cancelled),
        };
        if !output.status.success() {
            let snapshot_text = snapshot.to_string_lossy();
            let mut diagnostic = String::from_utf8_lossy(&output.stderr)
                .trim()
                .replace(snapshot_text.as_ref(), "<revision>");
            if !materialized.submodules.is_empty() {
                diagnostic.push_str("\nHistorical submodule content is not materialized.");
            }
            bail!("Typst compilation failed\n{diagnostic}");
        }
        if cancellation.is_cancelled() {
            return Ok(RenderOutcome::Cancelled);
        }
        let dependencies = read_dependencies(&deps_path)?;
        let manifest = self.publish_pages(revision, staging.path(), dependencies)?;
        Ok(RenderOutcome::Ready(manifest))
    }

    fn publish_pages(
        &self,
        revision: &Revision,
        staging: &Path,
        dependencies: Vec<String>,
    ) -> Result<CacheManifest> {
        let mut page_files = fs::read_dir(staging)
            .context("read rendered pages")?
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|extension| extension == "svg"))
            .collect::<Vec<_>>();
        page_files.sort_by_key(|path| page_number(path).unwrap_or(usize::MAX));
        if page_files.is_empty() {
            bail!("Typst produced no SVG pages");
        }

        let pages = page_files
            .iter()
            .enumerate()
            .map(|(index, path)| {
                let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
                let hash = hex_hash(&bytes);
                let file = format!("{hash}.svg");
                self.publish_blob(&hash, &bytes)?;
                Ok(PageArtifact {
                    number: index + 1,
                    file,
                    hash,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        self.publish_manifest(revision, dependencies, pages)
    }

    fn publish_embedded_pages(
        &self,
        revision: &Revision,
        staging: &Path,
        engine_pages: Vec<EnginePage>,
        dependencies: Vec<String>,
    ) -> Result<CacheManifest> {
        let pages = engine_pages
            .into_iter()
            .map(|page| {
                let file = format!("{}.svg", page.hash);
                let destination = self.cache_root.join("blobs/svg").join(&file);
                if let Some(staged_file) = page.staged_file {
                    let bytes = fs::read(staging.join(staged_file))
                        .with_context(|| format!("read embedded SVG page {}", page.number))?;
                    if hex_hash(&bytes) != page.hash {
                        bail!("embedded SVG page hash did not match worker result");
                    }
                    self.publish_blob(&page.hash, &bytes)?;
                } else if !destination.is_file() {
                    bail!(
                        "incremental SVG page {} is missing from the cache",
                        page.number
                    );
                }
                Ok(PageArtifact {
                    number: page.number,
                    file,
                    hash: page.hash,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        self.publish_manifest(revision, dependencies, pages)
    }

    fn publish_blob(&self, hash: &str, bytes: &[u8]) -> Result<()> {
        let blob_root = self.cache_root.join("blobs/svg");
        let destination = blob_root.join(format!("{hash}.svg"));
        if destination.exists() {
            return Ok(());
        }
        let mut temporary =
            tempfile::NamedTempFile::new_in(&blob_root).context("stage SVG blob")?;
        temporary.write_all(bytes).context("write SVG blob")?;
        temporary.flush().context("flush SVG blob")?;
        match temporary.persist_noclobber(&destination) {
            Ok(_) => Ok(()),
            Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
            Err(error) => Err(error.error).context("publish SVG blob"),
        }
    }

    fn publish_manifest(
        &self,
        revision: &Revision,
        dependencies: Vec<String>,
        pages: Vec<PageArtifact>,
    ) -> Result<CacheManifest> {
        let render_id = self.render_id(revision);
        let manifest = CacheManifest {
            version: CACHE_VERSION,
            render_id: render_id.clone(),
            revision_key: revision.key.clone(),
            compiler: self.compiler_version.clone(),
            entry: self.target.entry.clone(),
            root: self.target.root.clone(),
            dependencies,
            pages,
        };
        let render_root = self.cache_root.join("renders");
        let destination = render_root.join(&render_id);
        if !destination.exists() {
            let manifest_staging = Builder::new()
                .prefix("ttm-manifest-")
                .tempdir_in(&render_root)
                .context("create manifest staging directory")?;
            fs::write(
                manifest_staging.path().join("manifest.json"),
                serde_json::to_vec_pretty(&manifest)?,
            )
            .context("write render manifest")?;
            let kept = manifest_staging.keep();
            match fs::rename(&kept, &destination) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    let _ = fs::remove_dir_all(kept);
                }
                Err(error) => return Err(error).context("publish render manifest"),
            }
        }
        Ok(manifest)
    }

    fn cached_revision(&self, revision_key: &str) -> Result<Option<CacheManifest>> {
        let revision = self
            .revisions
            .get(revision_key)
            .with_context(|| format!("unknown revision {revision_key}"))?;
        self.cached_manifest(&self.render_id(revision))
    }

    fn render_id(&self, revision: &Revision) -> String {
        let mut hash = Sha256::new();
        hash.update(self.repository.info.identity.as_bytes());
        hash.update(revision.commit_id.as_bytes());
        hash.update(self.target.entry.as_os_str().as_encoded_bytes());
        hash.update(self.target.root.as_os_str().as_encoded_bytes());
        hash.update(self.compiler_version.as_bytes());
        hash.update(
            self.font_fingerprint
                .read()
                .expect("font fingerprint lock poisoned")
                .as_deref()
                .expect("embedded worker initialized before cache access")
                .as_bytes(),
        );
        hash.update(revision.committer_unix.to_le_bytes());
        for (key, value) in &self.target.inputs {
            hash.update(key.as_bytes());
            hash.update([0]);
            hash.update(value.as_bytes());
        }
        for path in &self.target.font_paths {
            hash.update(path.as_os_str().as_encoded_bytes());
        }
        if let Some(path) = &self.target.package_path {
            hash.update(path.as_os_str().as_encoded_bytes());
        }
        if let Some(path) = &self.target.package_cache_path {
            hash.update(path.as_os_str().as_encoded_bytes());
        }
        format!("{:x}", hash.finalize())
    }

    fn cached_manifest(&self, render_id: &str) -> Result<Option<CacheManifest>> {
        let path = self
            .cache_root
            .join("renders")
            .join(render_id)
            .join("manifest.json");
        if !path.exists() {
            return Ok(None);
        }
        let bytes = fs::read(&path).context("read cached render manifest")?;
        let manifest: CacheManifest =
            serde_json::from_slice(&bytes).context("parse cached render manifest")?;
        if manifest.version != CACHE_VERSION
            || manifest.render_id != render_id
            || manifest
                .pages
                .iter()
                .any(|page| !self.cache_root.join("blobs/svg").join(&page.file).is_file())
        {
            return Ok(None);
        }
        Ok(Some(manifest))
    }

    pub fn page_path(&self, render_id: &str, page_number: usize) -> Option<PathBuf> {
        if render_id.len() != 64 || !render_id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return None;
        }
        let artifacts = self.artifacts.read().ok()?;
        let page = artifacts
            .get(render_id)?
            .iter()
            .find(|page| page.number == page_number)?;
        Some(self.cache_root.join("blobs/svg").join(&page.file))
    }

    async fn set_phase(&self, key: &str, phase: RenderPhase, message: Option<String>) {
        if self.shutdown.is_cancelled() {
            return;
        }
        let mut statuses = self.statuses.write().await;
        let status = RenderStatus {
            revision_key: key.to_owned(),
            phase,
            message,
            render_id: None,
            pages: Vec::new(),
        };
        statuses.insert(key.to_owned(), status.clone());
        let _ = self.events.send(RenderEvent { status });
    }

    fn set_sync_phase(&self, key: &str, phase: RenderPhase, message: Option<String>) {
        if self.shutdown.is_cancelled() {
            return;
        }
        let mut statuses = self.statuses.blocking_write();
        let status = RenderStatus {
            revision_key: key.to_owned(),
            phase,
            message,
            render_id: None,
            pages: Vec::new(),
        };
        statuses.insert(key.to_owned(), status.clone());
        let _ = self.events.send(RenderEvent { status });
    }

    async fn set_ready(&self, key: &str, manifest: CacheManifest) {
        if self.shutdown.is_cancelled() {
            return;
        }
        if let Ok(mut artifacts) = self.artifacts.write() {
            artifacts.insert(manifest.render_id.clone(), manifest.pages.clone());
        }
        let mut statuses = self.statuses.write().await;
        let status = RenderStatus {
            revision_key: key.to_owned(),
            phase: RenderPhase::Ready,
            message: None,
            render_id: Some(manifest.render_id),
            pages: manifest.pages,
        };
        statuses.insert(key.to_owned(), status.clone());
        let _ = self.events.send(RenderEvent { status });
    }
}

fn push_job(
    heap: &mut BinaryHeap<Scheduled>,
    queued: &mut HashSet<String>,
    order: &mut u64,
    key: String,
    priority: u16,
) {
    if !queued.insert(key.clone()) {
        return;
    }
    *order += 1;
    heap.push(Scheduled {
        priority,
        order: *order,
        key,
    });
}

async fn run_worker_request(
    slot: &mut Option<WorkerClient>,
    config: &EngineConfig,
    request: EngineRequest,
    cancellation: &CancellationToken,
) -> Result<EngineReply> {
    for attempt in 0..2 {
        if slot.is_none() {
            *slot = Some(WorkerClient::start(config, cancellation).await?);
        }
        let client = slot.as_mut().expect("worker was initialized");
        match client.request(&request, cancellation).await {
            Ok(reply) => return Ok(reply),
            Err(error) if cancellation.is_cancelled() => return Err(error),
            Err(error) if attempt == 0 => {
                if let Some(mut failed) = slot.take() {
                    failed.stop().await;
                }
                eprintln!("Typst engine worker restarted after failure: {error:#}");
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!()
}

struct WorkerClient {
    child: Child,
    input: BufWriter<ChildStdin>,
    output: BufReader<ChildStdout>,
    font_fingerprint: String,
}

impl WorkerClient {
    async fn start(config: &EngineConfig, cancellation: &CancellationToken) -> Result<Self> {
        let executable = std::env::current_exe().context("locate ttm executable")?;
        let mut child = tokio::process::Command::new(executable)
            .arg("__engine-worker")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .context("start Typst engine worker")?;
        let input = BufWriter::new(child.stdin.take().context("open worker input")?);
        let output = BufReader::new(child.stdout.take().context("open worker output")?);
        let mut client = Self {
            child,
            input,
            output,
            font_fingerprint: String::new(),
        };
        let reply = client
            .request(
                &EngineRequest::Init {
                    config: config.clone(),
                },
                cancellation,
            )
            .await?;
        let EngineReply::Ready {
            font_fingerprint, ..
        } = reply
        else {
            bail!("Typst engine worker did not initialize");
        };
        client.font_fingerprint = font_fingerprint;
        Ok(client)
    }

    async fn request(
        &mut self,
        request: &EngineRequest,
        cancellation: &CancellationToken,
    ) -> Result<EngineReply> {
        let mut bytes = serde_json::to_vec(request).context("serialize engine request")?;
        bytes.push(b'\n');
        self.input
            .write_all(&bytes)
            .await
            .context("send engine request")?;
        self.input.flush().await.context("flush engine request")?;
        let mut line = String::new();
        tokio::select! {
            result = self.output.read_line(&mut line) => {
                let read = result.context("read engine reply")?;
                if read == 0 {
                    let status = self.child.wait().await.context("wait for engine worker")?;
                    bail!("Typst engine worker exited with {status}");
                }
            }
            _ = cancellation.cancelled() => {
                let _ = self.child.start_kill();
                let _ = self.child.wait().await;
                bail!("render cancelled");
            }
        }
        serde_json::from_str(&line).context("parse engine reply")
    }

    async fn stop(&mut self) {
        let _ = self.child.start_kill();
        let _ = self.child.wait().await;
    }
}

async fn run_compiler(command: Command, cancellation: CancellationToken) -> Result<CompileOutcome> {
    let mut stderr = tempfile::tempfile().context("create Typst diagnostic stream")?;
    let child_stderr = stderr
        .try_clone()
        .context("clone Typst diagnostic stream")?;
    let mut command = tokio::process::Command::from(command);
    command
        .stdout(Stdio::null())
        .stderr(Stdio::from(child_stderr))
        .kill_on_drop(true);
    let mut child = command.spawn().context("launch Typst compiler")?;
    let status: ExitStatus = tokio::select! {
        result = child.wait() => result.context("wait for Typst compiler")?,
        _ = cancellation.cancelled() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            return Ok(CompileOutcome::Cancelled);
        }
    };
    stderr
        .seek(SeekFrom::Start(0))
        .context("rewind Typst diagnostic stream")?;
    let mut diagnostics = Vec::new();
    stderr
        .read_to_end(&mut diagnostics)
        .context("read Typst diagnostics")?;
    Ok(CompileOutcome::Finished(Output {
        status,
        stdout: Vec::new(),
        stderr: diagnostics,
    }))
}

pub fn cache_root() -> Result<PathBuf> {
    if let Some(path) = std::env::var_os("XDG_CACHE_HOME") {
        return Ok(PathBuf::from(path).join("typst-time-machine"));
    }
    let base = BaseDirs::new().context("cannot determine platform cache directory")?;
    Ok(base.cache_dir().join("typst-time-machine"))
}

pub fn cache_info() -> Result<(PathBuf, u64, usize)> {
    let root = cache_root()?;
    if !root.exists() {
        return Ok((root, 0, 0));
    }
    let mut bytes = 0;
    let mut renders = 0;
    for entry in walkdir::WalkDir::new(&root) {
        let entry = entry?;
        if entry.file_type().is_file() {
            bytes += entry.metadata()?.len();
        }
        if entry.file_name() == "manifest.json" {
            renders += 1;
        }
    }
    Ok((root, bytes, renders))
}

pub fn clear_cache() -> Result<()> {
    let root = cache_root()?;
    if root.file_name().and_then(|name| name.to_str()) != Some("typst-time-machine") {
        bail!("refusing to clear unexpected cache path {}", root.display());
    }
    if root.exists() {
        fs::remove_dir_all(&root).context("clear Typst Time Machine cache")?;
    }
    Ok(())
}

fn probe_typst(target: &ResolvedTarget) -> Result<String> {
    let typst = target
        .typst
        .as_ref()
        .context("external Typst path is missing")?;
    let output = Command::new(typst)
        .arg("--version")
        .output()
        .with_context(|| format!("launch {}", typst.display()))?;
    if !output.status.success() {
        bail!(
            "Typst version check failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let numeric = version
        .split_whitespace()
        .find(|part| part.chars().next().is_some_and(|ch| ch.is_ascii_digit()))
        .context("Typst version output has no version number")?;
    let mut parts = numeric.split('.');
    let major: u32 = parts.next().unwrap_or("0").parse().unwrap_or(0);
    let minor: u32 = parts.next().unwrap_or("0").parse().unwrap_or(0);
    if (major, minor) < (0, 15) {
        bail!("Typst 0.15 or newer is required; found {version}");
    }
    Ok(format!("external {version}"))
}

fn probe_external_fonts(target: &ResolvedTarget) -> String {
    let Some(typst) = &target.typst else {
        return String::new();
    };
    let mut command = Command::new(typst);
    command.args(["fonts", "--variants"]);
    for font_path in &target.font_paths {
        command.arg("--font-path").arg(font_path);
    }
    let bytes = command
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| output.stdout)
        .unwrap_or_default();
    hex_hash(&bytes)
}

#[derive(Deserialize)]
struct TypstDependencies {
    #[serde(default)]
    inputs: Vec<String>,
}

fn read_dependencies(path: &Path) -> Result<Vec<String>> {
    let bytes = fs::read(path).context("read Typst dependency manifest")?;
    let deps: TypstDependencies =
        serde_json::from_slice(&bytes).context("parse Typst dependency manifest")?;
    Ok(deps.inputs)
}

fn page_number(path: &Path) -> Option<usize> {
    path.file_stem()?
        .to_str()?
        .strip_prefix("page-")?
        .split("-of-")
        .next()?
        .parse()
        .ok()
}

fn hex_hash(bytes: &[u8]) -> String {
    let mut hash = Sha256::new();
    hash.update(bytes);
    format!("{:x}", hash.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[tokio::test]
    async fn cancellation_terminates_and_reaps_compiler() {
        let mut command = Command::new("/bin/sleep");
        command.arg("60");
        let cancellation = CancellationToken::new();
        let pending = tokio::spawn(run_compiler(command, cancellation.clone()));
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        cancellation.cancel();

        let result = tokio::time::timeout(std::time::Duration::from_secs(1), pending)
            .await
            .expect("compiler cancellation timed out")
            .expect("compiler task panicked")
            .expect("compiler cancellation failed");
        assert!(matches!(result, CompileOutcome::Cancelled));
    }

    #[test]
    fn cache_root_has_fixed_final_component() {
        assert_eq!(
            cache_root().unwrap().file_name().unwrap(),
            "typst-time-machine"
        );
    }

    #[test]
    fn page_files_sort_numerically() {
        assert_eq!(page_number(Path::new("page-12-of-20.svg")), Some(12));
    }
}
