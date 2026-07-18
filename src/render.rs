use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, RwLock as StdRwLock},
};

use anyhow::{Context, Result, bail};
use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tempfile::Builder;
use tokio::sync::{RwLock, Semaphore, broadcast};

use crate::{
    config::ResolvedTarget,
    history::{HistoryRepository, Revision},
};

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

pub struct RenderManager {
    repository: Arc<HistoryRepository>,
    target: ResolvedTarget,
    revisions: HashMap<String, Revision>,
    cache_root: PathBuf,
    compiler_version: String,
    font_fingerprint: String,
    statuses: RwLock<HashMap<String, RenderStatus>>,
    artifacts: StdRwLock<HashMap<String, Vec<PageArtifact>>>,
    slots: Semaphore,
    events: broadcast::Sender<RenderEvent>,
}

enum SyncOutcome {
    Ready(CacheManifest),
    EntrypointMissing(String),
}

impl RenderManager {
    pub fn new(
        repository: Arc<HistoryRepository>,
        target: ResolvedTarget,
        revisions: &[Revision],
    ) -> Result<Arc<Self>> {
        let cache_root = cache_root()?;
        fs::create_dir_all(cache_root.join("renders"))
            .context("create Typst Time Machine cache")?;
        let compiler_version = probe_typst(&target)?;
        let font_fingerprint = probe_fonts(&target);
        let (events, _) = broadcast::channel(128);
        Ok(Arc::new(Self {
            repository,
            target,
            revisions: revisions
                .iter()
                .cloned()
                .map(|revision| (revision.key.clone(), revision))
                .collect(),
            cache_root,
            compiler_version,
            font_fingerprint,
            statuses: RwLock::new(HashMap::new()),
            artifacts: StdRwLock::new(HashMap::new()),
            slots: Semaphore::new(2),
            events,
        }))
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

    pub async fn statuses(&self) -> HashMap<String, RenderStatus> {
        self.statuses.read().await.clone()
    }

    pub async fn queue(self: &Arc<Self>, revision_key: &str) -> Result<()> {
        if !self.revisions.contains_key(revision_key) {
            bail!("unknown revision key");
        }
        {
            let mut statuses = self.statuses.write().await;
            if matches!(
                statuses.get(revision_key).map(|status| &status.phase),
                Some(
                    RenderPhase::Queued
                        | RenderPhase::Materializing
                        | RenderPhase::Compiling
                        | RenderPhase::Ready
                )
            ) {
                return Ok(());
            }
            let status = RenderStatus {
                revision_key: revision_key.to_owned(),
                phase: RenderPhase::Queued,
                message: None,
                render_id: None,
                pages: Vec::new(),
            };
            statuses.insert(revision_key.to_owned(), status.clone());
            let _ = self.events.send(RenderEvent { status });
        }

        let manager = Arc::clone(self);
        let key = revision_key.to_owned();
        tokio::spawn(async move {
            let cache_manager = Arc::clone(&manager);
            let cache_key = key.clone();
            let cached =
                tokio::task::spawn_blocking(move || cache_manager.cached_revision(&cache_key))
                    .await;
            match cached {
                Ok(Ok(Some(manifest))) => {
                    manager.set_ready(&key, manifest).await;
                    return;
                }
                Ok(Ok(None)) => {}
                Ok(Err(error)) => {
                    manager
                        .set_phase(&key, RenderPhase::Error, Some(format!("{error:#}")))
                        .await;
                    return;
                }
                Err(error) => {
                    manager
                        .set_phase(
                            &key,
                            RenderPhase::Error,
                            Some(format!("cache task failed: {error}")),
                        )
                        .await;
                    return;
                }
            }
            let permit = match manager.slots.acquire().await {
                Ok(permit) => permit,
                Err(_) => return,
            };
            manager
                .set_phase(&key, RenderPhase::Materializing, None)
                .await;
            let sync_manager = Arc::clone(&manager);
            let sync_key = key.clone();
            let result =
                tokio::task::spawn_blocking(move || sync_manager.render_sync(&sync_key)).await;
            drop(permit);
            match result {
                Ok(Ok(SyncOutcome::Ready(manifest))) => {
                    manager.set_ready(&key, manifest).await;
                }
                Ok(Ok(SyncOutcome::EntrypointMissing(message))) => {
                    manager
                        .set_phase(&key, RenderPhase::EntrypointMissing, Some(message))
                        .await;
                }
                Ok(Err(error)) => {
                    manager
                        .set_phase(&key, RenderPhase::Error, Some(format!("{error:#}")))
                        .await;
                }
                Err(error) => {
                    manager
                        .set_phase(
                            &key,
                            RenderPhase::Error,
                            Some(format!("render task failed: {error}")),
                        )
                        .await;
                }
            }
        });
        Ok(())
    }

    async fn set_phase(&self, key: &str, phase: RenderPhase, message: Option<String>) {
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

    async fn set_ready(&self, key: &str, manifest: CacheManifest) {
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

    fn set_sync_phase(&self, key: &str, phase: RenderPhase, message: Option<String>) {
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

    fn render_sync(&self, revision_key: &str) -> Result<SyncOutcome> {
        let revision = self
            .revisions
            .get(revision_key)
            .with_context(|| format!("unknown revision {revision_key}"))?;
        let render_id = self.render_id(revision);
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
        self.set_sync_phase(revision_key, RenderPhase::Compiling, None);
        let entry = snapshot.join(&self.target.entry);
        let metadata = match fs::symlink_metadata(&entry) {
            Ok(metadata) => metadata,
            Err(_) => {
                return Ok(SyncOutcome::EntrypointMissing(format!(
                    "{} does not exist in {}",
                    self.target.entry.display(),
                    &revision.commit_id[..revision.commit_id.len().min(12)]
                )));
            }
        };
        if !metadata.file_type().is_file() && !metadata.file_type().is_symlink() {
            return Ok(SyncOutcome::EntrypointMissing(format!(
                "{} is not a Typst file in this revision",
                self.target.entry.display()
            )));
        }

        let project_root = snapshot.join(&self.target.root);
        let deps_path = staging.path().join("deps.json");
        let output_pattern = staging.path().join("page-{0p}-of-{t}.svg");
        let mut command = Command::new(&self.target.typst);
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

        let output = command.output().context("launch Typst compiler")?;
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

        let mut page_files = fs::read_dir(staging.path())
            .context("read rendered pages")?
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "svg"))
            .collect::<Vec<_>>();
        page_files.sort();
        if page_files.is_empty() {
            bail!("Typst produced no SVG pages");
        }
        let pages = page_files
            .iter()
            .enumerate()
            .map(|(index, path)| {
                let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
                Ok(PageArtifact {
                    number: index + 1,
                    file: path
                        .file_name()
                        .context("rendered page has no filename")?
                        .to_string_lossy()
                        .into_owned(),
                    hash: hex_hash(&bytes),
                })
            })
            .collect::<Result<Vec<_>>>()?;
        let dependencies = read_dependencies(&deps_path)?;
        let manifest = CacheManifest {
            version: 1,
            render_id: render_id.clone(),
            revision_key: revision.key.clone(),
            compiler: self.compiler_version.clone(),
            entry: self.target.entry.clone(),
            root: self.target.root.clone(),
            dependencies,
            pages,
        };
        fs::write(
            staging.path().join("manifest.json"),
            serde_json::to_vec_pretty(&manifest)?,
        )
        .context("write render manifest")?;

        let destination = self.cache_root.join("renders").join(&render_id);
        if destination.exists() {
            fs::remove_dir_all(&destination).context("replace incomplete cache entry")?;
        }
        let kept = staging.keep();
        fs::rename(&kept, &destination).context("publish render cache entry")?;
        Ok(SyncOutcome::Ready(manifest))
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
        hash.update(self.font_fingerprint.as_bytes());
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
        let directory = self.cache_root.join("renders").join(render_id);
        let path = directory.join("manifest.json");
        if !path.exists() {
            return Ok(None);
        }
        let bytes = fs::read(&path).context("read cached render manifest")?;
        let manifest: CacheManifest =
            serde_json::from_slice(&bytes).context("parse cached render manifest")?;
        if manifest.version != 1
            || manifest.render_id != render_id
            || manifest
                .pages
                .iter()
                .any(|page| !directory.join(&page.file).is_file())
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
        Some(
            self.cache_root
                .join("renders")
                .join(render_id)
                .join(&page.file),
        )
    }
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
    let output = Command::new(&target.typst)
        .arg("--version")
        .output()
        .with_context(|| format!("launch {}", target.typst.display()))?;
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
    Ok(version)
}

fn probe_fonts(target: &ResolvedTarget) -> String {
    let mut command = Command::new(&target.typst);
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

fn hex_hash(bytes: &[u8]) -> String {
    let mut hash = Sha256::new();
    hash.update(bytes);
    format!("{:x}", hash.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_root_has_fixed_final_component() {
        assert_eq!(
            cache_root().unwrap().file_name().unwrap(),
            "typst-time-machine"
        );
    }

    #[test]
    fn hashes_are_stable() {
        assert_eq!(hex_hash(b"same"), hex_hash(b"same"));
        assert_ne!(hex_hash(b"same"), hex_hash(b"different"));
    }
}
