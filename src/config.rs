use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

pub const CONFIG_FILE: &str = ".typst-time-machine.toml";

#[derive(Debug, Default, Deserialize)]
pub struct ProjectConfig {
    pub default_target: Option<String>,
    #[serde(default)]
    pub targets: BTreeMap<String, TargetConfig>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct TargetConfig {
    pub entry: PathBuf,
    #[serde(default = "default_root")]
    pub root: PathBuf,
    #[serde(default)]
    pub history_paths: Vec<PathBuf>,
    #[serde(default)]
    pub font_paths: Vec<PathBuf>,
    #[serde(default)]
    pub inputs: BTreeMap<String, String>,
    pub package_path: Option<PathBuf>,
    pub package_cache_path: Option<PathBuf>,
}

#[derive(Debug)]
pub struct ResolveRequest {
    pub cwd: PathBuf,
    pub entry: Option<PathBuf>,
    pub target: Option<String>,
    pub root: Option<PathBuf>,
    pub history_paths: Vec<PathBuf>,
    pub font_paths: Vec<PathBuf>,
    pub inputs: Vec<String>,
    pub package_path: Option<PathBuf>,
    pub package_cache_path: Option<PathBuf>,
    pub typst: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ResolvedTarget {
    pub name: Option<String>,
    pub entry: PathBuf,
    pub root: PathBuf,
    pub history_paths: Vec<PathBuf>,
    pub font_paths: Vec<PathBuf>,
    pub inputs: BTreeMap<String, String>,
    pub package_path: Option<PathBuf>,
    pub package_cache_path: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typst: Option<PathBuf>,
}

fn default_root() -> PathBuf {
    PathBuf::from(".")
}

pub fn load(repository_root: &Path) -> Result<ProjectConfig> {
    let path = repository_root.join(CONFIG_FILE);
    if !path.exists() {
        return Ok(ProjectConfig::default());
    }
    let source =
        fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?;
    toml::from_str(&source).with_context(|| format!("failed to parse {}", path.display()))
}

pub fn resolve(repository_root: &Path, request: ResolveRequest) -> Result<ResolvedTarget> {
    let repository_root_buf = repository_root
        .canonicalize()
        .context("canonicalize repository root")?;
    let repository_root = repository_root_buf.as_path();
    let config = load(repository_root)?;
    let selected_name = request.target.or_else(|| {
        if request.entry.is_none() {
            config.default_target.clone()
        } else {
            None
        }
    });
    let selected = selected_name
        .as_ref()
        .map(|name| {
            config
                .targets
                .get(name)
                .cloned()
                .with_context(|| format!("target {name:?} not found in {CONFIG_FILE}"))
        })
        .transpose()?;

    let configured = selected.unwrap_or_default();
    let entry_from_cli = request.entry.is_some();
    let entry_input = request.entry.or_else(|| {
        if configured.entry.as_os_str().is_empty() {
            None
        } else {
            Some(configured.entry.clone())
        }
    });
    let entry_input =
        entry_input.context("provide an entrypoint or select a configured target with --target")?;

    let entry_base = if entry_from_cli {
        &request.cwd
    } else {
        repository_root
    };
    let entry_abs =
        confined_existing_path(repository_root, entry_base, &entry_input, "entrypoint")?;

    let root_input = request.root.unwrap_or(configured.root);
    let root_base = repository_root;
    let root_abs = confined_existing_path(repository_root, root_base, &root_input, "Typst root")?;
    if !entry_abs.starts_with(&root_abs) {
        bail!(
            "entrypoint {} is outside Typst root {}",
            entry_abs.display(),
            root_abs.display()
        );
    }

    let history_inputs = if request.history_paths.is_empty() {
        configured.history_paths
    } else {
        request.history_paths
    };
    let history_paths = history_inputs
        .into_iter()
        .map(|path| confined_relative_path(repository_root, repository_root, &path, "history path"))
        .collect::<Result<Vec<_>>>()?;

    let fonts_from_cli = !request.font_paths.is_empty();
    let font_inputs = if request.font_paths.is_empty() {
        configured.font_paths
    } else {
        request.font_paths
    };
    let font_paths = font_inputs
        .into_iter()
        .map(|path| {
            absolute_user_path(
                if fonts_from_cli {
                    &request.cwd
                } else {
                    repository_root
                },
                &path,
            )
        })
        .collect();

    let mut inputs = configured.inputs;
    for raw in request.inputs {
        let (key, value) = raw
            .split_once('=')
            .with_context(|| format!("Typst input must use key=value: {raw:?}"))?;
        if key.is_empty() {
            bail!("Typst input key cannot be empty");
        }
        inputs.insert(key.to_owned(), value.to_owned());
    }

    let package_path = match (request.package_path, configured.package_path) {
        (Some(path), _) => Some(absolute_user_path(&request.cwd, &path)),
        (None, Some(path)) => Some(absolute_user_path(repository_root, &path)),
        (None, None) => None,
    };
    let package_cache_path = match (request.package_cache_path, configured.package_cache_path) {
        (Some(path), _) => Some(absolute_user_path(&request.cwd, &path)),
        (None, Some(path)) => Some(absolute_user_path(repository_root, &path)),
        (None, None) => None,
    };

    Ok(ResolvedTarget {
        name: selected_name,
        entry: entry_abs
            .strip_prefix(repository_root)
            .expect("confined entrypoint")
            .to_path_buf(),
        root: root_abs
            .strip_prefix(repository_root)
            .expect("confined root")
            .to_path_buf(),
        history_paths,
        font_paths,
        inputs,
        package_path,
        package_cache_path,
        typst: request.typst,
    })
}

fn absolute_user_path(base: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    }
}

fn confined_existing_path(
    repository_root: &Path,
    base: &Path,
    path: &Path,
    label: &str,
) -> Result<PathBuf> {
    let joined = absolute_user_path(base, path);
    let canonical = joined
        .canonicalize()
        .with_context(|| format!("{label} does not exist: {}", joined.display()))?;
    if !canonical.starts_with(repository_root) {
        bail!(
            "{label} {} escapes repository {}",
            canonical.display(),
            repository_root.display()
        );
    }
    Ok(canonical)
}

fn confined_relative_path(
    repository_root: &Path,
    base: &Path,
    path: &Path,
    label: &str,
) -> Result<PathBuf> {
    let joined = absolute_user_path(base, path);
    let normalized = lexical_normalize(&joined)?;
    if !normalized.starts_with(repository_root) {
        bail!(
            "{label} {} escapes repository {}",
            normalized.display(),
            repository_root.display()
        );
    }
    Ok(normalized
        .strip_prefix(repository_root)
        .expect("confined path")
        .to_path_buf())
}

fn lexical_normalize(path: &Path) -> Result<PathBuf> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => parts.push(Component::Prefix(prefix)),
            Component::RootDir => {
                parts.clear();
                parts.push(Component::RootDir);
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if !matches!(parts.last(), Some(Component::Normal(_))) {
                    bail!("path escapes its root: {}", path.display());
                }
                parts.pop();
            }
            Component::Normal(_) => parts.push(component),
        }
    }
    let mut normalized = PathBuf::new();
    for component in parts {
        normalized.push(component.as_os_str());
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_parent_escape() {
        let error = lexical_normalize(Path::new("/repo/../../outside")).unwrap_err();
        assert!(error.to_string().contains("escapes"));
    }

    #[test]
    fn command_inputs_override_config() {
        let mut inputs = BTreeMap::from([("variant".to_owned(), "base".to_owned())]);
        let raw = "variant=esa";
        let (key, value) = raw.split_once('=').unwrap();
        inputs.insert(key.to_owned(), value.to_owned());
        assert_eq!(inputs.get("variant").unwrap(), "esa");
    }

    #[test]
    fn resolves_saved_target_and_cli_overrides() -> Result<()> {
        let temp = tempfile::tempdir()?;
        let root = temp.path();
        fs::create_dir(root.join("applications"))?;
        fs::write(root.join("applications/resume.typ"), "= Resume\n")?;
        fs::write(
            root.join(CONFIG_FILE),
            r#"
default_target = "resume"

[targets.resume]
entry = "applications/resume.typ"
root = "."
inputs = { variant = "base" }
"#,
        )?;
        let target = resolve(
            root,
            ResolveRequest {
                cwd: root.to_path_buf(),
                entry: None,
                target: None,
                root: None,
                history_paths: Vec::new(),
                font_paths: Vec::new(),
                inputs: vec!["variant=compact".to_owned()],
                package_path: None,
                package_cache_path: None,
                typst: Some(PathBuf::from("typst")),
            },
        )?;
        assert_eq!(target.name.as_deref(), Some("resume"));
        assert_eq!(target.entry, Path::new("applications/resume.typ"));
        assert_eq!(target.inputs["variant"], "compact");
        Ok(())
    }
}
