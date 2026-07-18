use std::{
    collections::{HashMap, HashSet},
    ffi::OsString,
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
    process::{Command, Output, Stdio},
};

use anyhow::{Context, Result, bail};
use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

#[derive(Clone, Copy, Debug, Serialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum VcsPreference {
    Auto,
    Git,
    Jj,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum VcsKind {
    Git,
    Jj,
}

#[derive(Clone, Debug, Serialize)]
pub struct RepoInfo {
    pub kind: VcsKind,
    pub root: PathBuf,
    pub identity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Revision {
    pub key: String,
    pub commit_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub change_id: Option<String>,
    pub parent_ids: Vec<String>,
    pub subject: String,
    pub author: String,
    pub author_email: String,
    pub authored_at: String,
    pub committed_at: String,
    pub committer_unix: i64,
    pub bookmarks: Vec<String>,
    pub changed_paths: Vec<PathBuf>,
}

#[derive(Clone, Debug)]
pub struct History {
    pub revisions: Vec<Revision>,
    pub first_parent_keys: Vec<String>,
    pub full_tree_keys: Vec<String>,
}

#[derive(Clone, Copy, Debug)]
enum HistoryTraversal {
    FirstParent,
    FullTree,
}

#[derive(Debug)]
pub struct HistoryRepository {
    pub info: RepoInfo,
    git_dir: PathBuf,
}

#[derive(Debug)]
pub struct MaterializedTree {
    pub submodules: Vec<PathBuf>,
}

#[derive(Debug, Deserialize)]
struct JjCommit {
    commit_id: String,
    parents: Vec<String>,
    change_id: String,
    description: String,
    author: JjSignature,
    committer: JjSignature,
}

#[derive(Debug, Deserialize)]
struct JjSignature {
    name: String,
    email: String,
    timestamp: String,
}

impl HistoryRepository {
    pub fn git_dir(&self) -> &Path {
        &self.git_dir
    }

    pub fn discover(start: &Path, preference: VcsPreference) -> Result<Self> {
        let start = if start.is_file() {
            start
                .parent()
                .context("entrypoint has no parent directory")?
        } else {
            start
        };
        match preference {
            VcsPreference::Jj => Self::discover_jj(start),
            VcsPreference::Git => Self::discover_git(start),
            VcsPreference::Auto => {
                if find_jj_workspace(start).is_some() {
                    Self::discover_jj(start)
                } else {
                    Self::discover_git(start)
                }
            }
        }
    }

    fn discover_jj(start: &Path) -> Result<Self> {
        let workspace = find_jj_workspace(start)
            .with_context(|| format!("no JJ workspace found at or above {}", start.display()))?;
        let root = run_text(
            Command::new("jj")
                .arg("--ignore-working-copy")
                .arg("--at-operation=@")
                .arg("-R")
                .arg(workspace)
                .arg("root"),
            "discover JJ repository",
        )?;
        let root = PathBuf::from(root.trim())
            .canonicalize()
            .context("canonicalize JJ repository root")?;
        let operation_id = run_text(
            Command::new("jj")
                .arg("--ignore-working-copy")
                .arg("-R")
                .arg(&root)
                .args(["op", "log", "--no-graph", "-n", "1", "-T"])
                .arg("self.id() ++ \"\\n\""),
            "pin JJ operation",
        )?
        .trim()
        .to_owned();
        let git_dir = run_text(
            Command::new("jj")
                .arg("--at-operation")
                .arg(&operation_id)
                .arg("-R")
                .arg(&root)
                .args(["git", "root"]),
            "resolve JJ Git backend",
        )
        .context("JJ repository is not Git-backed; only Git-backed JJ is supported in v0.1")?;
        let git_dir = PathBuf::from(git_dir.trim())
            .canonicalize()
            .context("canonicalize JJ Git backend")?;
        let identity = repository_identity(&git_dir);
        Ok(Self {
            info: RepoInfo {
                kind: VcsKind::Jj,
                root,
                identity,
                operation_id: Some(operation_id),
            },
            git_dir,
        })
    }

    fn discover_git(start: &Path) -> Result<Self> {
        let root = run_text(
            Command::new("git")
                .arg("-C")
                .arg(start)
                .args(["rev-parse", "--show-toplevel"]),
            "discover Git repository",
        )?;
        let root = PathBuf::from(root.trim())
            .canonicalize()
            .context("canonicalize Git repository root")?;
        let git_dir = run_text(
            Command::new("git")
                .arg("-C")
                .arg(&root)
                .args(["rev-parse", "--absolute-git-dir"]),
            "resolve Git directory",
        )?;
        let git_dir = PathBuf::from(git_dir.trim())
            .canonicalize()
            .context("canonicalize Git directory")?;
        let identity = repository_identity(&git_dir);
        Ok(Self {
            info: RepoInfo {
                kind: VcsKind::Git,
                root,
                identity,
                operation_id: None,
            },
            git_dir,
        })
    }

    #[cfg(test)]
    pub fn revisions(
        &self,
        start: Option<&str>,
        limit: usize,
        history_paths: &[PathBuf],
    ) -> Result<Vec<Revision>> {
        let mut revisions =
            self.collect_revision_metadata(start, limit, HistoryTraversal::FirstParent)?;
        self.enrich_revisions(&mut revisions)?;
        filter_revisions(&mut revisions, history_paths);
        Ok(revisions)
    }

    pub fn history(
        &self,
        start: Option<&str>,
        limit: usize,
        history_paths: &[PathBuf],
    ) -> Result<History> {
        let first_parent =
            self.collect_revision_metadata(start, limit, HistoryTraversal::FirstParent)?;
        let full_tree = self.collect_revision_metadata(start, limit, HistoryTraversal::FullTree)?;
        let mut revisions = full_tree.clone();
        let mut known = revisions
            .iter()
            .map(|revision| revision.commit_id.clone())
            .collect::<HashSet<_>>();
        for revision in &first_parent {
            if known.insert(revision.commit_id.clone()) {
                revisions.push(revision.clone());
            }
        }
        self.enrich_revisions(&mut revisions)?;
        filter_revisions(&mut revisions, history_paths);
        let visible = revisions
            .iter()
            .map(|revision| revision.commit_id.as_str())
            .collect::<HashSet<_>>();
        let first_parent_keys = first_parent
            .iter()
            .filter(|revision| visible.contains(revision.commit_id.as_str()))
            .map(|revision| revision.key.clone())
            .collect();
        let full_tree_keys = full_tree
            .iter()
            .filter(|revision| visible.contains(revision.commit_id.as_str()))
            .map(|revision| revision.key.clone())
            .collect();
        Ok(History {
            revisions,
            first_parent_keys,
            full_tree_keys,
        })
    }

    fn collect_revision_metadata(
        &self,
        start: Option<&str>,
        limit: usize,
        traversal: HistoryTraversal,
    ) -> Result<Vec<Revision>> {
        let revisions = match self.info.kind {
            VcsKind::Git => self.git_revisions(start.unwrap_or("HEAD"), limit, traversal)?,
            VcsKind::Jj => self.jj_revisions(start.unwrap_or("@-"), limit, traversal)?,
        };
        Ok(revisions)
    }

    fn enrich_revisions(&self, revisions: &mut [Revision]) -> Result<()> {
        let bookmark_map = match self.info.kind {
            VcsKind::Git => self.git_bookmarks()?,
            VcsKind::Jj => self.jj_bookmarks()?,
        };
        let changed_paths = self.changed_paths_many(revisions)?;
        for revision in revisions.iter_mut() {
            revision.bookmarks = bookmark_map
                .get(&revision.commit_id)
                .cloned()
                .unwrap_or_default();
            revision.changed_paths = changed_paths
                .get(&revision.commit_id)
                .cloned()
                .unwrap_or_default();
        }
        Ok(())
    }

    fn git_revisions(
        &self,
        start: &str,
        limit: usize,
        traversal: HistoryTraversal,
    ) -> Result<Vec<Revision>> {
        let resolved = run_text(
            Command::new("git")
                .arg("--git-dir")
                .arg(&self.git_dir)
                .args(["rev-parse", "--verify"])
                .arg(format!("{start}^{{commit}}")),
            "resolve Git start revision",
        )?;
        let format = "%H%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%ct%x00%s%x00%x1e";
        let mut command = Command::new("git");
        command.arg("--git-dir").arg(&self.git_dir).arg("log");
        match traversal {
            HistoryTraversal::FirstParent => {
                command.arg("--first-parent");
            }
            HistoryTraversal::FullTree => {
                command.args(["--topo-order", "--date-order"]);
            }
        }
        command
            .arg(format!("--max-count={limit}"))
            .arg(format!("--format={format}"))
            .arg(resolved.trim());
        let output = run(&mut command, "read Git history")?;
        parse_git_log(&output.stdout)
    }

    fn jj_revisions(
        &self,
        start: &str,
        limit: usize,
        traversal: HistoryTraversal,
    ) -> Result<Vec<Revision>> {
        let operation = self
            .info
            .operation_id
            .as_deref()
            .context("missing pinned JJ operation")?;
        let revset = history_revset(start, traversal);
        let output = run_text(
            Command::new("jj")
                .arg("--at-operation")
                .arg(operation)
                .arg("-R")
                .arg(&self.info.root)
                .args(["log", "-r"])
                .arg(&revset)
                .arg("-n")
                .arg(limit.to_string())
                .args(["--no-graph", "-T"])
                .arg("json(self) ++ \"\\n\""),
            "read JJ history",
        )?;
        output
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                let commit: JjCommit =
                    serde_json::from_str(line).context("parse JJ JSON commit")?;
                Ok(Revision {
                    key: format!("jj:{}", commit.commit_id),
                    commit_id: commit.commit_id,
                    change_id: Some(commit.change_id),
                    parent_ids: commit.parents,
                    subject: first_line(&commit.description),
                    author: commit.author.name,
                    author_email: commit.author.email,
                    authored_at: commit.author.timestamp,
                    committer_unix: parse_unix(&commit.committer.timestamp)?,
                    committed_at: commit.committer.timestamp,
                    bookmarks: Vec::new(),
                    changed_paths: Vec::new(),
                })
            })
            .collect()
    }

    fn git_bookmarks(&self) -> Result<HashMap<String, Vec<String>>> {
        let output = run_text(
            Command::new("git")
                .arg("--git-dir")
                .arg(&self.git_dir)
                .args([
                    "for-each-ref",
                    "--format=%(objectname)%09%(refname:short)",
                    "refs/heads",
                    "refs/tags",
                ]),
            "read Git refs",
        )?;
        Ok(parse_bookmark_lines(&output))
    }

    fn jj_bookmarks(&self) -> Result<HashMap<String, Vec<String>>> {
        let operation = self
            .info
            .operation_id
            .as_deref()
            .context("missing pinned JJ operation")?;
        let output = run_text(
            Command::new("jj")
                .arg("--at-operation")
                .arg(operation)
                .arg("-R")
                .arg(&self.info.root)
                .args(["bookmark", "list", "-T"])
                .arg(
                    "if(self.normal_target(), self.normal_target().commit_id() ++ \"\\t\" ++ self.name() ++ \"\\n\")",
                ),
            "read JJ bookmarks",
        )?;
        Ok(parse_bookmark_lines(&output))
    }

    fn changed_paths_many(&self, revisions: &[Revision]) -> Result<HashMap<String, Vec<PathBuf>>> {
        if revisions.is_empty() {
            return Ok(HashMap::new());
        }
        let mut child = Command::new("git")
            .arg("--git-dir")
            .arg(&self.git_dir)
            .args([
                "diff-tree",
                "--stdin",
                "--root",
                "--diff-merges=first-parent",
                "--format=%x1e%H",
                "--name-only",
                "-r",
                "-z",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("failed to read changed paths")?;
        {
            let input = child.stdin.as_mut().context("open Git history input")?;
            for revision in revisions {
                writeln!(input, "{}", revision.commit_id).context("write Git history input")?;
            }
        }
        let output = child.wait_with_output().context("wait for changed paths")?;
        if !output.status.success() {
            bail!(
                "read changed paths: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        parse_changed_paths(&output.stdout)
    }

    pub fn materialize(&self, revision: &Revision, destination: &Path) -> Result<MaterializedTree> {
        if destination.exists() {
            bail!(
                "materialization destination already exists: {}",
                destination.display()
            );
        }
        fs::create_dir_all(destination)
            .with_context(|| format!("create {}", destination.display()))?;
        let parent = destination
            .parent()
            .context("materialization destination has no parent")?;
        let index = parent.join("index");
        let treeish = format!("{}^{{tree}}", revision.commit_id);
        let mut read_tree = Command::new("git");
        read_tree
            .env("GIT_INDEX_FILE", &index)
            .env("GIT_NO_LAZY_FETCH", "1")
            .arg("--git-dir")
            .arg(&self.git_dir)
            .args(["read-tree", "--no-sparse-checkout", "--reset"])
            .arg(&treeish);
        run(&mut read_tree, "load immutable revision tree")?;

        let mut prefix = destination.as_os_str().to_os_string();
        prefix.push(std::path::MAIN_SEPARATOR.to_string());
        let mut checkout = Command::new("git");
        checkout
            .env("GIT_INDEX_FILE", &index)
            .env("GIT_NO_LAZY_FETCH", "1")
            .arg("--git-dir")
            .arg(&self.git_dir)
            .args([
                "checkout-index",
                "--all",
                "--force",
                "--ignore-skip-worktree-bits",
            ])
            .arg(format!("--prefix={}", PathBuf::from(prefix).display()));
        run(&mut checkout, "materialize immutable revision tree")?;
        audit_symlinks(destination)?;
        let submodules = self.submodules(&revision.commit_id)?;
        Ok(MaterializedTree { submodules })
    }

    fn submodules(&self, commit_id: &str) -> Result<Vec<PathBuf>> {
        let output = run(
            Command::new("git")
                .arg("--git-dir")
                .arg(&self.git_dir)
                .args(["ls-tree", "-r", "-z", commit_id]),
            "inspect revision tree",
        )?;
        Ok(output
            .stdout
            .split(|byte| *byte == 0)
            .filter_map(|entry| {
                let tab = entry.iter().position(|byte| *byte == b'\t')?;
                let header = String::from_utf8_lossy(&entry[..tab]);
                if header.starts_with("160000 ") {
                    Some(PathBuf::from(
                        String::from_utf8_lossy(&entry[tab + 1..]).into_owned(),
                    ))
                } else {
                    None
                }
            })
            .collect())
    }
}

fn history_revset(start: &str, traversal: HistoryTraversal) -> String {
    match traversal {
        HistoryTraversal::FirstParent => format!("first_ancestors({start}) & ~root()"),
        HistoryTraversal::FullTree => format!("ancestors({start}) & ~root()"),
    }
}

fn find_jj_workspace(start: &Path) -> Option<&Path> {
    start
        .ancestors()
        .find(|ancestor| ancestor.join(".jj").exists())
}

fn run(command: &mut Command, action: &str) -> Result<Output> {
    let output = command
        .output()
        .with_context(|| format!("failed to {action}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        bail!("{action}: {stderr}");
    }
    Ok(output)
}

fn run_text(command: &mut Command, action: &str) -> Result<String> {
    let output = run(command, action)?;
    String::from_utf8(output.stdout).with_context(|| format!("{action} returned non-UTF-8 output"))
}

fn repository_identity(git_dir: &Path) -> String {
    let mut hash = Sha256::new();
    hash.update(git_dir.as_os_str().as_encoded_bytes());
    crate::hash::lower_hex(hash.finalize())
}

fn parse_unix(timestamp: &str) -> Result<i64> {
    Ok(chrono::DateTime::parse_from_rfc3339(timestamp)
        .with_context(|| format!("invalid VCS timestamp {timestamp:?}"))?
        .timestamp())
}

fn first_line(description: &str) -> String {
    description
        .lines()
        .next()
        .unwrap_or("(no description)")
        .trim()
        .to_owned()
}

fn parse_bookmark_lines(source: &str) -> HashMap<String, Vec<String>> {
    let mut result = HashMap::new();
    for line in source.lines() {
        let Some((commit, names)) = line.split_once('\t') else {
            continue;
        };
        let names = names
            .split_whitespace()
            .map(|name| name.trim_end_matches('*').to_owned())
            .filter(|name| !name.is_empty())
            .collect::<Vec<_>>();
        if !names.is_empty() {
            result
                .entry(commit.to_owned())
                .or_insert_with(Vec::new)
                .extend(names);
        }
    }
    result
}

fn parse_git_log(source: &[u8]) -> Result<Vec<Revision>> {
    source
        .split(|byte| *byte == 0x1e)
        .filter(|record| record.iter().any(|byte| !byte.is_ascii_whitespace()))
        .map(|record| {
            let fields = record
                .split(|byte| *byte == 0)
                .map(|field| {
                    String::from_utf8_lossy(field)
                        .trim_matches(|c: char| c == '\n' || c == '\r')
                        .to_owned()
                })
                .collect::<Vec<_>>();
            if fields.len() < 10 {
                bail!(
                    "Git history record has {} fields, expected 10",
                    fields.len()
                );
            }
            let commit_id = fields[0].clone();
            Ok(Revision {
                key: format!("git:{commit_id}"),
                commit_id,
                change_id: None,
                parent_ids: fields[1]
                    .split_whitespace()
                    .map(ToOwned::to_owned)
                    .collect(),
                author: fields[2].clone(),
                author_email: fields[3].clone(),
                authored_at: fields[4].clone(),
                committed_at: fields[7].clone(),
                committer_unix: fields[8].parse().context("parse Git committer timestamp")?,
                subject: fields[9].clone(),
                bookmarks: Vec::new(),
                changed_paths: Vec::new(),
            })
        })
        .collect()
}

fn paths_overlap(changed: &Path, filter: &Path) -> bool {
    changed == filter || changed.starts_with(filter) || filter.starts_with(changed)
}

fn filter_revisions(revisions: &mut Vec<Revision>, history_paths: &[PathBuf]) {
    if history_paths.is_empty() {
        return;
    }
    revisions.retain(|revision| {
        revision.changed_paths.iter().any(|changed| {
            history_paths
                .iter()
                .any(|path| paths_overlap(changed, path))
        })
    });
}

fn parse_changed_paths(source: &[u8]) -> Result<HashMap<String, Vec<PathBuf>>> {
    let mut result = HashMap::new();
    for record in source
        .split(|byte| *byte == 0x1e)
        .filter(|record| !record.is_empty())
    {
        let mut fields = record.split(|byte| *byte == 0);
        let commit = fields.next().context("changed-path record has no commit")?;
        let commit = String::from_utf8_lossy(commit)
            .trim_matches(['\n', '\r'])
            .to_owned();
        if commit.is_empty() {
            continue;
        }
        let paths = fields
            .filter_map(|field| {
                let field = field
                    .iter()
                    .skip_while(|byte| **byte == b'\n' || **byte == b'\r')
                    .copied()
                    .collect::<Vec<_>>();
                (!field.is_empty())
                    .then(|| PathBuf::from(String::from_utf8_lossy(&field).into_owned()))
            })
            .collect();
        result.insert(commit, paths);
    }
    Ok(result)
}

fn audit_symlinks(root: &Path) -> Result<()> {
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = entry.context("inspect materialized revision")?;
        if !entry.file_type().is_symlink() {
            continue;
        }
        let link = fs::read_link(entry.path())
            .with_context(|| format!("read symlink {}", entry.path().display()))?;
        if link.is_absolute() {
            bail!(
                "historical symlink escapes snapshot: {} -> {}",
                entry.path().display(),
                link.display()
            );
        }
        let parent = entry.path().parent().context("symlink has no parent")?;
        let resolved = lexical_join(parent, &link)?;
        if !resolved.starts_with(root) {
            bail!(
                "historical symlink escapes snapshot: {} -> {}",
                entry.path().display(),
                link.display()
            );
        }
    }
    Ok(())
}

fn lexical_join(base: &Path, relative: &Path) -> Result<PathBuf> {
    let mut components = base
        .components()
        .map(|component| component.as_os_str().to_os_string())
        .collect::<Vec<OsString>>();
    for component in relative.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if components.pop().is_none() {
                    bail!("symlink path escapes filesystem root");
                }
            }
            Component::Normal(value) => components.push(value.to_os_string()),
            Component::RootDir | Component::Prefix(_) => bail!("absolute symlink path"),
        }
    }
    let mut result = PathBuf::new();
    for component in components {
        result.push(component);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Stdio;

    #[test]
    fn parses_jj_bookmarks_without_working_copy_marker() {
        let parsed = parse_bookmark_lines("abc\twip/demo* release\n");
        assert_eq!(parsed["abc"], ["wip/demo", "release"]);
    }

    #[test]
    fn history_filters_match_directories() {
        assert!(paths_overlap(
            Path::new("applications/example.typ"),
            Path::new("applications")
        ));
        assert!(!paths_overlap(
            Path::new("src/main.rs"),
            Path::new("applications")
        ));
    }

    #[test]
    fn parses_batched_changed_paths() -> Result<()> {
        let parsed = parse_changed_paths(
            b"\x1eaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\0\nmain.typ\0assets/a.png\0\
              \x1ebbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\0\nnested/file.typ\0",
        )?;
        assert_eq!(
            parsed["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
            [PathBuf::from("main.typ"), PathBuf::from("assets/a.png")]
        );
        assert_eq!(
            parsed["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
            [PathBuf::from("nested/file.typ")]
        );
        Ok(())
    }

    #[test]
    fn git_history_and_materialization_ignore_dirty_files() -> Result<()> {
        let temp = tempfile::tempdir()?;
        let root = temp.path().join("repo");
        fs::create_dir(&root)?;
        git(&root, &["init", "-b", "main"])?;
        fs::write(root.join("main.typ"), "= First\n")?;
        git(&root, &["add", "main.typ"])?;
        commit(&root, "first")?;
        fs::write(root.join("main.typ"), "= Second\n")?;
        git(&root, &["add", "main.typ"])?;
        commit(&root, "second")?;
        fs::write(root.join("main.typ"), "= Dirty\n")?;
        fs::write(root.join("untracked.typ"), "= Untracked\n")?;

        let repository = HistoryRepository::discover(&root, VcsPreference::Git)?;
        let revisions = repository.revisions(None, 10, &[])?;
        assert_eq!(revisions.len(), 2);
        assert_eq!(revisions[0].subject, "second");

        let materialized_parent = tempfile::tempdir()?;
        let materialized = materialized_parent.path().join("tree");
        repository.materialize(&revisions[0], &materialized)?;
        assert_eq!(
            fs::read_to_string(materialized.join("main.typ"))?,
            "= Second\n"
        );
        assert!(!materialized.join("untracked.typ").exists());
        assert!(git_text(&root, &["status", "--porcelain"])?.contains("main.typ"));
        Ok(())
    }

    #[test]
    fn colocated_repository_prefers_jj_without_advancing_operation() -> Result<()> {
        if Command::new("jj")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_err()
        {
            return Ok(());
        }
        let temp = tempfile::tempdir()?;
        let root = temp.path().join("repo");
        fs::create_dir(&root)?;
        git(&root, &["init", "-b", "main"])?;
        fs::write(root.join("main.typ"), "= First\n")?;
        fs::create_dir(root.join("nested"))?;
        fs::write(root.join("nested").join("entry.typ"), "= Nested\n")?;
        git(&root, &["add", "main.typ"])?;
        git(&root, &["add", "nested/entry.typ"])?;
        commit(&root, "first")?;
        let status = Command::new("jj")
            .args(["git", "init", "--colocate"])
            .arg(&root)
            .status()?;
        assert!(status.success());

        let before = jj_operation(&root)?;
        let repository =
            HistoryRepository::discover(&root.join("nested/entry.typ"), VcsPreference::Auto)?;
        assert_eq!(repository.info.kind, VcsKind::Jj);
        let revisions = repository.revisions(None, 10, &[])?;
        assert_eq!(revisions.len(), 1);
        assert_eq!(revisions[0].subject, "first");
        let after = jj_operation(&root)?;
        assert_eq!(before, after);

        let forced_git =
            HistoryRepository::discover(&root.join("nested/entry.typ"), VcsPreference::Git)?;
        assert_eq!(forced_git.info.kind, VcsKind::Git);
        Ok(())
    }

    #[test]
    fn full_history_keeps_side_branches_and_first_parent_story() -> Result<()> {
        let temp = tempfile::tempdir()?;
        let root = temp.path().join("repo");
        fs::create_dir(&root)?;
        git(&root, &["init", "-b", "main"])?;
        fs::write(root.join("main.typ"), "= Base\n")?;
        git(&root, &["add", "main.typ"])?;
        commit(&root, "base")?;
        git(&root, &["checkout", "-b", "feature"])?;
        fs::write(root.join("feature.typ"), "= Feature\n")?;
        git(&root, &["add", "feature.typ"])?;
        commit(&root, "feature")?;
        git(&root, &["checkout", "main"])?;
        fs::write(root.join("main.typ"), "= Main\n")?;
        git(&root, &["add", "main.typ"])?;
        commit(&root, "main")?;
        git(
            &root,
            &[
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.com",
                "merge",
                "--no-ff",
                "feature",
                "-m",
                "merge feature",
            ],
        )?;

        let repository = HistoryRepository::discover(&root, VcsPreference::Git)?;
        let history = repository.history(None, 10, &[])?;
        let first_parent_subjects = history
            .first_parent_keys
            .iter()
            .map(|key| {
                history
                    .revisions
                    .iter()
                    .find(|revision| &revision.key == key)
                    .map(|revision| revision.subject.as_str())
                    .unwrap()
            })
            .collect::<Vec<_>>();
        let full_subjects = history
            .full_tree_keys
            .iter()
            .map(|key| {
                history
                    .revisions
                    .iter()
                    .find(|revision| &revision.key == key)
                    .map(|revision| revision.subject.as_str())
                    .unwrap()
            })
            .collect::<Vec<_>>();

        assert_eq!(first_parent_subjects, ["merge feature", "main", "base"]);
        assert!(full_subjects.contains(&"feature"));
        assert_eq!(history.revisions.len(), 4);
        let merge = history
            .revisions
            .iter()
            .find(|revision| revision.subject == "merge feature")
            .unwrap();
        assert_eq!(merge.changed_paths, [PathBuf::from("feature.typ")]);
        Ok(())
    }

    fn git(root: &Path, args: &[&str]) -> Result<()> {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .output()?;
        if !output.status.success() {
            bail!("{}", String::from_utf8_lossy(&output.stderr));
        }
        Ok(())
    }

    fn git_text(root: &Path, args: &[&str]) -> Result<String> {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .output()?;
        if !output.status.success() {
            bail!("{}", String::from_utf8_lossy(&output.stderr));
        }
        Ok(String::from_utf8(output.stdout)?)
    }

    fn commit(root: &Path, message: &str) -> Result<()> {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(["-c", "user.name=Test", "-c", "user.email=test@example.com"])
            .args(["commit", "-m", message])
            .output()?;
        if !output.status.success() {
            bail!("{}", String::from_utf8_lossy(&output.stderr));
        }
        Ok(())
    }

    fn jj_operation(root: &Path) -> Result<String> {
        let output = Command::new("jj")
            .arg("--ignore-working-copy")
            .arg("-R")
            .arg(root)
            .args(["op", "log", "--no-graph", "-n", "1", "-T"])
            .arg("self.id() ++ \"\\n\"")
            .output()?;
        if !output.status.success() {
            bail!("{}", String::from_utf8_lossy(&output.stderr));
        }
        Ok(String::from_utf8(output.stdout)?.trim().to_owned())
    }
}
