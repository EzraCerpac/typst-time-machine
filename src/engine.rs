use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    io::{BufRead, BufReader, BufWriter, Read, Write},
    path::{Component, Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::Mutex,
};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use typst::{
    Library, LibraryExt, World,
    diag::{FileError, FileResult},
    foundations::{Bytes, Datetime, Dict, Duration, Str, Value},
    syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot},
    text::{Font, FontBook},
    utils::LazyHash,
};
use typst_kit::{
    datetime::Time,
    diagnostics::{DiagnosticFormat, DiagnosticWorld, emit, termcolor::NoColor},
    downloader::SystemDownloader,
    files::{FileLoader, FileStore},
    fonts::{self, FontStore},
    packages::{FsPackages, SystemPackages, UniversePackages},
};
use typst_layout::PagedDocument;
use typst_svg::SvgOptions;

pub const EMBEDDED_TYPST_VERSION: &str = "0.15.0";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EngineConfig {
    pub git_dir: PathBuf,
    pub entry: PathBuf,
    pub root: PathBuf,
    pub inputs: BTreeMap<String, String>,
    pub font_paths: Vec<PathBuf>,
    pub package_path: Option<PathBuf>,
    pub package_cache_path: Option<PathBuf>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineRequest {
    Init {
        config: EngineConfig,
    },
    Compile {
        commit_id: String,
        committer_unix: i64,
        staging: PathBuf,
    },
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineReply {
    Ready {
        retained_bytes: u64,
        font_fingerprint: String,
    },
    Compiled {
        pages: Vec<EnginePage>,
        dependencies: Vec<String>,
        retained_bytes: u64,
    },
    EntrypointMissing {
        message: String,
        retained_bytes: u64,
    },
    Error {
        message: String,
        retained_bytes: u64,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EnginePage {
    pub number: usize,
    pub hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub staged_file: Option<String>,
}

pub fn run_worker() -> Result<()> {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut input = stdin.lock().lines();
    let mut output = BufWriter::new(stdout.lock());

    let first = input.next().context("missing engine initialization")??;
    let EngineRequest::Init { config } =
        serde_json::from_str(&first).context("parse engine initialization")?
    else {
        bail!("first engine request must initialize the worker");
    };
    let mut engine = Engine::new(config)?;
    write_reply(
        &mut output,
        &EngineReply::Ready {
            retained_bytes: engine.retained_bytes(),
            font_fingerprint: engine.font_fingerprint.clone(),
        },
    )?;

    for line in input {
        let request: EngineRequest = serde_json::from_str(&line.context("read engine request")?)
            .context("parse engine request")?;
        let reply = match request {
            EngineRequest::Init { .. } => EngineReply::Error {
                message: "worker is already initialized".to_owned(),
                retained_bytes: engine.retained_bytes(),
            },
            EngineRequest::Compile {
                commit_id,
                committer_unix,
                staging,
            } => engine.compile(&commit_id, committer_unix, &staging),
        };
        write_reply(&mut output, &reply)?;
    }
    Ok(())
}

fn write_reply(output: &mut impl Write, reply: &EngineReply) -> Result<()> {
    serde_json::to_writer(&mut *output, reply).context("serialize engine reply")?;
    output.write_all(b"\n").context("write engine reply")?;
    output.flush().context("flush engine reply")
}

struct Engine {
    world: EngineWorld,
    entry: PathBuf,
    page_hashes: HashMap<u128, String>,
    revision_results: HashMap<(String, i64), CachedRevision>,
    font_fingerprint: String,
}

#[derive(Clone)]
struct CachedRevision {
    pages: Vec<(usize, String)>,
    dependencies: Vec<String>,
}

impl Engine {
    fn new(config: EngineConfig) -> Result<Self> {
        let entry = config
            .entry
            .strip_prefix(&config.root)
            .with_context(|| {
                format!(
                    "entrypoint {} is outside Typst root {}",
                    config.entry.display(),
                    config.root.display()
                )
            })?
            .to_path_buf();
        let entry_text = entry
            .to_str()
            .context("Typst entrypoint path is not valid UTF-8")?;
        let main = RootedPath::new(
            VirtualRoot::Project,
            VirtualPath::new(entry_text).context("normalize Typst entrypoint")?,
        )
        .intern();

        let inputs: Dict = config
            .inputs
            .iter()
            .map(|(key, value)| {
                (
                    Str::from(key.as_str()),
                    Value::Str(Str::from(value.as_str())),
                )
            })
            .collect();
        let library = LazyHash::new(Library::builder().with_inputs(inputs).build());

        let mut font_store = FontStore::new();
        let mut font_hash = Sha256::new();
        for path in &config.font_paths {
            font_hash.update(path.as_os_str().as_encoded_bytes());
            for (slot, info) in fonts::scan(path) {
                font_hash.update(format!("{info:?}").as_bytes());
                font_store.push((slot, info));
            }
        }
        for (slot, info) in fonts::system() {
            font_hash.update(format!("{info:?}").as_bytes());
            font_store.push((slot, info));
        }
        for (slot, info) in fonts::embedded() {
            font_hash.update(format!("{info:?}").as_bytes());
            font_store.push((slot, info));
        }
        let font_fingerprint = crate::hash::lower_hex(font_hash.finalize());

        let data = config
            .package_path
            .map(FsPackages::new)
            .or_else(FsPackages::system_data);
        let cache = config
            .package_cache_path
            .map(FsPackages::new)
            .or_else(FsPackages::system_cache);
        let packages = SystemPackages::from_parts(
            data,
            cache,
            UniversePackages::new(SystemDownloader::new(format!(
                "typst-time-machine/{}",
                env!("CARGO_PKG_VERSION")
            ))),
        );
        let loader = GitLoader::new(config.git_dir, config.root, packages)?;
        let world = EngineWorld {
            library,
            fonts: font_store,
            main,
            files: FileStore::new(loader),
            time: Time::fixed_timestamp(0).expect("Unix epoch is valid"),
        };
        Ok(Self {
            world,
            entry,
            page_hashes: HashMap::new(),
            revision_results: HashMap::new(),
            font_fingerprint,
        })
    }

    fn compile(&mut self, commit_id: &str, committer_unix: i64, staging: &Path) -> EngineReply {
        let reply = self.compile_inner(commit_id, committer_unix, staging);
        typst::comemo::evict(10);
        match reply {
            Ok(reply) => reply,
            Err(error) => EngineReply::Error {
                message: format!("{error:#}"),
                retained_bytes: self.retained_bytes(),
            },
        }
    }

    fn compile_inner(
        &mut self,
        commit_id: &str,
        committer_unix: i64,
        staging: &Path,
    ) -> Result<EngineReply> {
        let revision_key = (commit_id.to_owned(), committer_unix);
        if let Some(cached) = self.revision_results.get(&revision_key) {
            return Ok(EngineReply::Compiled {
                pages: cached
                    .pages
                    .iter()
                    .map(|(number, hash)| EnginePage {
                        number: *number,
                        hash: hash.clone(),
                        staged_file: None,
                    })
                    .collect(),
                dependencies: cached.dependencies.clone(),
                retained_bytes: self.retained_bytes(),
            });
        }

        self.world
            .files
            .loader_mut()
            .prepare(commit_id)
            .context("index immutable revision")?;
        self.world.files.reset();
        self.world.time = Time::fixed_timestamp(committer_unix)
            .map_err(|error| anyhow::anyhow!("set revision creation timestamp: {error}"))?;

        if !self.world.files.loader().contains_project_path(&self.entry) {
            return Ok(EngineReply::EntrypointMissing {
                message: format!(
                    "{} does not exist in {}",
                    self.entry.display(),
                    &commit_id[..commit_id.len().min(12)]
                ),
                retained_bytes: self.retained_bytes(),
            });
        }

        fs::create_dir_all(staging)
            .with_context(|| format!("create render staging directory {}", staging.display()))?;
        let compiled = typst::compile::<PagedDocument>(&self.world);
        let document = match compiled.output {
            Ok(document) => document,
            Err(errors) => {
                return Ok(EngineReply::Error {
                    message: format_diagnostics(&self.world, errors.iter()),
                    retained_bytes: self.retained_bytes(),
                });
            }
        };
        if document.pages().is_empty() {
            bail!("Typst produced no SVG pages");
        }

        let pages = document
            .pages()
            .iter()
            .enumerate()
            .map(|(index, page)| {
                // SVG export observes the frame, bleed, and resolved fill. Logical
                // page metadata such as supplements can change across recompiles
                // without changing a single emitted byte.
                let page_key =
                    typst::utils::hash128(&(&page.frame, page.bleed, page.fill_or_white()));
                if let Some(hash) = self.page_hashes.get(&page_key) {
                    return Ok(EnginePage {
                        number: index + 1,
                        hash: hash.clone(),
                        staged_file: None,
                    });
                }
                let svg = typst_svg::svg(page, &SvgOptions::default());
                let hash = content_hash(svg.as_bytes());
                let staged_file = format!("{hash}.svg");
                fs::write(staging.join(&staged_file), svg)
                    .with_context(|| format!("write rendered page {}", index + 1))?;
                self.page_hashes.insert(page_key, hash.clone());
                Ok(EnginePage {
                    number: index + 1,
                    hash,
                    staged_file: Some(staged_file),
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let dependencies = {
            let (loader, ids) = self.world.files.dependencies();
            let mut paths = ids.map(|id| loader.name(id)).collect::<Vec<_>>();
            paths.sort();
            paths.dedup();
            paths
        };
        self.revision_results.insert(
            revision_key,
            CachedRevision {
                pages: pages
                    .iter()
                    .map(|page| (page.number, page.hash.clone()))
                    .collect(),
                dependencies: dependencies.clone(),
            },
        );
        Ok(EngineReply::Compiled {
            pages,
            dependencies,
            retained_bytes: self.retained_bytes(),
        })
    }

    fn retained_bytes(&self) -> u64 {
        self.world.files.loader().retained_bytes()
    }
}

fn content_hash(bytes: &[u8]) -> String {
    let mut hash = Sha256::new();
    hash.update(bytes);
    crate::hash::lower_hex(hash.finalize())
}

struct EngineWorld {
    library: LazyHash<Library>,
    fonts: FontStore,
    main: FileId,
    files: FileStore<GitLoader>,
    time: Time,
}

impl World for EngineWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.fonts.book()
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        self.files.source(id)
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.file(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }

    fn today(&self, offset: Option<Duration>) -> Option<Datetime> {
        self.time.today(offset)
    }
}

impl DiagnosticWorld for EngineWorld {
    fn name(&self, id: FileId) -> String {
        self.files.loader().name(id)
    }
}

fn format_diagnostics<'a>(
    world: &EngineWorld,
    diagnostics: impl IntoIterator<Item = &'a typst::diag::SourceDiagnostic>,
) -> String {
    let mut output = NoColor::new(Vec::new());
    if emit(&mut output, world, diagnostics, DiagnosticFormat::Short).is_err() {
        return "Typst compilation failed".to_owned();
    }
    String::from_utf8_lossy(&output.into_inner())
        .trim()
        .to_owned()
}

#[derive(Clone)]
struct TreeEntry {
    mode: u32,
    kind: String,
    oid: String,
}

struct GitLoader {
    git_dir: PathBuf,
    project_root: PathBuf,
    entries: HashMap<PathBuf, TreeEntry>,
    packages: SystemPackages,
    batch: Mutex<GitBatch>,
    blobs: Mutex<HashMap<String, Bytes>>,
}

impl GitLoader {
    fn new(git_dir: PathBuf, project_root: PathBuf, packages: SystemPackages) -> Result<Self> {
        let batch = GitBatch::spawn(&git_dir)?;
        Ok(Self {
            git_dir,
            project_root,
            entries: HashMap::new(),
            packages,
            batch: Mutex::new(batch),
            blobs: Mutex::new(HashMap::new()),
        })
    }

    fn prepare(&mut self, commit_id: &str) -> Result<()> {
        let output = Command::new("git")
            .env("GIT_NO_LAZY_FETCH", "1")
            .arg("--git-dir")
            .arg(&self.git_dir)
            .args(["ls-tree", "-r", "-z", "--full-tree", commit_id])
            .output()
            .context("launch git ls-tree")?;
        if !output.status.success() {
            bail!(
                "git ls-tree failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        let mut entries = HashMap::new();
        for record in output.stdout.split(|byte| *byte == 0) {
            if record.is_empty() {
                continue;
            }
            let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
                continue;
            };
            let header = std::str::from_utf8(&record[..tab]).context("non-UTF-8 tree header")?;
            let path =
                std::str::from_utf8(&record[tab + 1..]).context("non-UTF-8 repository path")?;
            let mut fields = header.split_whitespace();
            let mode = u32::from_str_radix(fields.next().context("tree entry has no mode")?, 8)
                .context("parse tree mode")?;
            let kind = fields.next().context("tree entry has no kind")?.to_owned();
            let oid = fields
                .next()
                .context("tree entry has no object id")?
                .to_owned();
            entries.insert(PathBuf::from(path), TreeEntry { mode, kind, oid });
        }
        self.entries = entries;
        Ok(())
    }

    fn contains_project_path(&self, path: &Path) -> bool {
        self.resolve_project_path(path).is_ok()
    }

    fn name(&self, id: FileId) -> String {
        match id.root() {
            VirtualRoot::Project => id.vpath().get_without_slash().to_owned(),
            VirtualRoot::Package(spec) => {
                format!("@{spec}/{}", id.vpath().get_without_slash())
            }
        }
    }

    fn retained_bytes(&self) -> u64 {
        self.blobs
            .lock()
            .map(|blobs| blobs.values().map(|bytes| bytes.len() as u64).sum())
            .unwrap_or(0)
    }

    fn resolve_project_path(&self, virtual_path: &Path) -> Result<PathBuf, FileError> {
        let mut candidate =
            lexical_join(&self.project_root, virtual_path).ok_or(FileError::AccessDenied)?;
        if !candidate.starts_with(&self.project_root) {
            return Err(FileError::AccessDenied);
        }
        let mut visited = HashSet::new();
        for _ in 0..16 {
            let Some((link_path, link)) = self.first_special_prefix(&candidate) else {
                return self
                    .entries
                    .contains_key(&candidate)
                    .then_some(candidate)
                    .ok_or_else(|| FileError::NotFound(virtual_path.to_path_buf()));
            };
            if link.mode == 0o160000 || link.kind == "commit" {
                return Err(FileError::Other(Some(
                    format!(
                        "historical submodule content is unavailable: {}",
                        link_path.display()
                    )
                    .into(),
                )));
            }
            if link.mode != 0o120000 {
                return self
                    .entries
                    .contains_key(&candidate)
                    .then_some(candidate)
                    .ok_or_else(|| FileError::NotFound(virtual_path.to_path_buf()));
            }
            if !visited.insert(link_path.clone()) {
                return Err(FileError::Other(Some("historical symlink cycle".into())));
            }
            let target = self
                .blob(&link.oid)
                .map_err(|error| FileError::Other(Some(error.to_string().into())))?;
            let target = std::str::from_utf8(&target)
                .map_err(|_| FileError::Other(Some("non-UTF-8 historical symlink".into())))?;
            let target = Path::new(target);
            if target.is_absolute() {
                return Err(FileError::AccessDenied);
            }
            let suffix = candidate
                .strip_prefix(&link_path)
                .expect("matched path prefix");
            let parent = link_path.parent().unwrap_or(Path::new(""));
            candidate = lexical_join(parent, target)
                .and_then(|path| lexical_join(&path, suffix))
                .filter(|path| path.starts_with(&self.project_root))
                .ok_or(FileError::AccessDenied)?;
        }
        Err(FileError::Other(Some(
            "historical symlink resolution exceeded 16 hops".into(),
        )))
    }

    fn first_special_prefix(&self, path: &Path) -> Option<(PathBuf, &TreeEntry)> {
        let mut prefix = PathBuf::new();
        for component in path.components() {
            prefix.push(component.as_os_str());
            if let Some(entry) = self.entries.get(&prefix)
                && (entry.mode == 0o120000 || entry.mode == 0o160000 || entry.kind == "commit")
            {
                return Some((prefix, entry));
            }
        }
        None
    }

    fn blob(&self, oid: &str) -> Result<Bytes> {
        if let Some(bytes) = self.blobs.lock().expect("blob cache poisoned").get(oid) {
            return Ok(bytes.clone());
        }
        let bytes = self
            .batch
            .lock()
            .expect("git batch process poisoned")
            .contents(oid)?;
        if bytes.starts_with(b"version https://git-lfs.github.com/spec/v1\n") {
            bail!("Git LFS content is unavailable without network");
        }
        let bytes = Bytes::new(bytes);
        self.blobs
            .lock()
            .expect("blob cache poisoned")
            .insert(oid.to_owned(), bytes.clone());
        Ok(bytes)
    }
}

impl FileLoader for GitLoader {
    fn load(&self, id: FileId) -> FileResult<Bytes> {
        match id.root() {
            VirtualRoot::Project => {
                let path = self.resolve_project_path(Path::new(id.vpath().get_without_slash()))?;
                let entry = self
                    .entries
                    .get(&path)
                    .ok_or_else(|| FileError::NotFound(path.clone()))?;
                if entry.kind != "blob" {
                    return Err(FileError::IsDirectory);
                }
                self.blob(&entry.oid)
                    .map_err(|error| FileError::Other(Some(error.to_string().into())))
            }
            VirtualRoot::Package(spec) => self
                .packages
                .obtain(spec)
                .map_err(FileError::from)?
                .load(id.vpath()),
        }
    }
}

fn lexical_join(base: &Path, relative: &Path) -> Option<PathBuf> {
    let mut result = PathBuf::from(base);
    for component in relative.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !result.pop() {
                    return None;
                }
            }
            Component::Normal(part) => result.push(part),
            Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    Some(result)
}

struct GitBatch {
    child: Child,
    input: BufWriter<ChildStdin>,
    output: BufReader<ChildStdout>,
}

impl GitBatch {
    fn spawn(git_dir: &Path) -> Result<Self> {
        let mut child = Command::new("git")
            .env("GIT_NO_LAZY_FETCH", "1")
            .arg("--git-dir")
            .arg(git_dir)
            .args(["cat-file", "--batch-command", "--buffer"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .context("launch git cat-file")?;
        let input = BufWriter::new(child.stdin.take().context("open git cat-file input")?);
        let output = BufReader::new(child.stdout.take().context("open git cat-file output")?);
        Ok(Self {
            child,
            input,
            output,
        })
    }

    fn contents(&mut self, oid: &str) -> Result<Vec<u8>> {
        writeln!(self.input, "contents {oid}").context("request Git object")?;
        writeln!(self.input, "flush").context("flush Git object request")?;
        self.input.flush().context("send Git object request")?;

        let mut header = String::new();
        self.output
            .read_line(&mut header)
            .context("read Git object header")?;
        if header.is_empty() {
            bail!("git cat-file exited unexpectedly");
        }
        if header.trim_end().ends_with(" missing") {
            bail!("Git object {oid} is unavailable; lazy fetching is disabled");
        }
        let mut fields = header.split_whitespace();
        let actual = fields.next().context("Git object header has no id")?;
        let kind = fields.next().context("Git object header has no kind")?;
        let size: usize = fields
            .next()
            .context("Git object header has no size")?
            .parse()
            .context("parse Git object size")?;
        if actual != oid || kind != "blob" {
            bail!(
                "unexpected Git object response for {oid}: {}",
                header.trim()
            );
        }
        let mut bytes = vec![0; size];
        self.output
            .read_exact(&mut bytes)
            .context("read Git object contents")?;
        let mut newline = [0];
        self.output
            .read_exact(&mut newline)
            .context("read Git object terminator")?;
        if newline[0] != b'\n' {
            bail!("Git object response had no terminator");
        }
        Ok(bytes)
    }
}

impl Drop for GitBatch {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lexical_paths_stay_relative() {
        assert_eq!(
            lexical_join(Path::new("docs"), Path::new("images/a.png")),
            Some(PathBuf::from("docs/images/a.png"))
        );
        assert_eq!(
            lexical_join(Path::new("docs"), Path::new("/etc/passwd")),
            None
        );
    }

    #[test]
    fn persistent_world_reads_only_committed_git_objects() -> Result<()> {
        let temp = tempfile::tempdir()?;
        let repository = temp.path().join("repo");
        fs::create_dir(&repository)?;
        run_git(&repository, &["init", "-q"])?;
        fs::write(
            repository.join("main.typ"),
            "#set text(font: \"New Computer Modern\")\n= Revision A\n",
        )?;
        commit_all(&repository, "revision a")?;
        let revision_a = git_text(&repository, &["rev-parse", "HEAD"])?;

        fs::write(
            repository.join("main.typ"),
            "#set text(font: \"New Computer Modern\")\n= Revision B\n",
        )?;
        commit_all(&repository, "revision b")?;
        let revision_b = git_text(&repository, &["rev-parse", "HEAD"])?;
        fs::write(repository.join("main.typ"), "= Dirty working copy\n")?;

        let git_dir = PathBuf::from(git_text(&repository, &["rev-parse", "--absolute-git-dir"])?);
        let mut engine = Engine::new(EngineConfig {
            git_dir,
            entry: PathBuf::from("main.typ"),
            root: PathBuf::new(),
            inputs: BTreeMap::new(),
            font_paths: Vec::new(),
            package_path: None,
            package_cache_path: Some(temp.path().join("packages")),
        })?;

        let render_a = temp.path().join("a");
        let render_b = temp.path().join("b");
        let render_a_again = temp.path().join("a-again");
        let EngineReply::Compiled { pages: first, .. } = engine.compile(&revision_a, 1, &render_a)
        else {
            bail!("revision A did not compile");
        };
        let EngineReply::Compiled { pages: second, .. } = engine.compile(&revision_b, 2, &render_b)
        else {
            bail!("revision B did not compile");
        };
        let EngineReply::Compiled {
            pages: repeated, ..
        } = engine.compile(&revision_a, 1, &render_a_again)
        else {
            bail!("revision A repeat did not compile");
        };
        assert_eq!(first.len(), 1);
        assert_eq!(second.len(), 1);
        assert_eq!(repeated.len(), 1);
        assert_eq!(first[0].hash, repeated[0].hash);
        assert_ne!(first[0].hash, second[0].hash);
        assert!(repeated[0].staged_file.is_none());

        let first = fs::read(
            render_a.join(
                first[0]
                    .staged_file
                    .as_deref()
                    .context("first render stages its SVG")?,
            ),
        )?;
        let second = fs::read(
            render_b.join(
                second[0]
                    .staged_file
                    .as_deref()
                    .context("changed render stages its SVG")?,
            ),
        )?;
        assert_ne!(first, second);
        assert!(!String::from_utf8_lossy(&first).contains("Dirty working copy"));
        assert!(engine.retained_bytes() > 0);
        Ok(())
    }

    fn commit_all(repository: &Path, message: &str) -> Result<()> {
        run_git(repository, &["add", "."])?;
        run_git(
            repository,
            &[
                "-c",
                "user.name=TTM Test",
                "-c",
                "user.email=ttm@example.invalid",
                "commit",
                "-qm",
                message,
            ],
        )
    }

    fn git_text(repository: &Path, args: &[&str]) -> Result<String> {
        let output = Command::new("git")
            .current_dir(repository)
            .args(args)
            .output()
            .context("run Git")?;
        if !output.status.success() {
            bail!("Git failed: {}", String::from_utf8_lossy(&output.stderr));
        }
        Ok(String::from_utf8(output.stdout)?.trim().to_owned())
    }

    fn run_git(repository: &Path, args: &[&str]) -> Result<()> {
        let status = Command::new("git")
            .current_dir(repository)
            .args(args)
            .status()
            .context("run Git")?;
        if !status.success() {
            bail!("Git failed with {status}");
        }
        Ok(())
    }
}
