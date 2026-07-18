mod config;
mod history;
mod render;
mod server;

use std::{path::PathBuf, sync::Arc};

use anyhow::{Context, Result, bail};
use clap::{Args, Parser, Subcommand};

use crate::{
    config::{ResolveRequest, resolve},
    history::{HistoryRepository, VcsPreference},
    render::{RenderManager, cache_info, clear_cache},
};

#[derive(Debug, Parser)]
#[command(
    name = "ttm",
    version,
    about = "Browse rendered Typst documents through Git and Jujutsu history"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Open the rendered history viewer
    View(Box<ViewArgs>),
    /// Inspect or clear the render cache
    Cache {
        #[command(subcommand)]
        command: CacheCommand,
    },
}

#[derive(Debug, Args)]
struct ViewArgs {
    /// Typst entrypoint; optional when a configured target is selected
    entry: Option<PathBuf>,

    /// Named target from .typst-time-machine.toml
    #[arg(long)]
    target: Option<String>,

    /// Typst project root, relative to the repository
    #[arg(long)]
    root: Option<PathBuf>,

    /// Version-control backend
    #[arg(long, value_enum, default_value_t = VcsPreference::Auto)]
    vcs: VcsPreference,

    /// Starting Git revision or JJ revset
    #[arg(long)]
    at: Option<String>,

    /// Maximum first-parent revisions to inspect
    #[arg(long, default_value_t = 30)]
    limit: usize,

    /// Restrict history to commits touching this repository-relative path
    #[arg(long = "history-path")]
    history_paths: Vec<PathBuf>,

    /// Typst sys.input value as key=value
    #[arg(long = "input")]
    inputs: Vec<String>,

    /// Additional Typst font directory
    #[arg(long = "font-path")]
    font_paths: Vec<PathBuf>,

    /// Typst local package directory
    #[arg(long)]
    package_path: Option<PathBuf>,

    /// Typst package cache directory
    #[arg(long)]
    package_cache_path: Option<PathBuf>,

    /// Typst compiler executable
    #[arg(long, default_value = "typst")]
    typst: PathBuf,

    /// Print viewer URL without opening a browser
    #[arg(long)]
    no_open: bool,
}

#[derive(Debug, Subcommand)]
enum CacheCommand {
    /// Show cache path and size
    Info,
    /// Delete all Typst Time Machine render artifacts
    Clear,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::View(args) => view(*args).await,
        Command::Cache { command } => cache(command),
    }
}

async fn view(args: ViewArgs) -> Result<()> {
    if !(1..=500).contains(&args.limit) {
        bail!("--limit must be between 1 and 500");
    }
    let cwd = std::env::current_dir().context("read current directory")?;
    let discovery_start = args
        .entry
        .as_ref()
        .map(|entry| {
            if entry.is_absolute() {
                entry.clone()
            } else {
                cwd.join(entry)
            }
        })
        .unwrap_or_else(|| cwd.clone());
    let repository = Arc::new(HistoryRepository::discover(&discovery_start, args.vcs)?);
    let target = resolve(
        &repository.info.root,
        ResolveRequest {
            cwd,
            entry: args.entry,
            target: args.target,
            root: args.root,
            history_paths: args.history_paths,
            font_paths: args.font_paths,
            inputs: args.inputs,
            package_path: args.package_path,
            package_cache_path: args.package_cache_path,
            typst: args.typst,
        },
    )?;
    let revisions = repository.revisions(args.at.as_deref(), args.limit, &target.history_paths)?;
    if revisions.is_empty() {
        bail!("no matching first-parent revisions found");
    }

    let render = RenderManager::new(Arc::clone(&repository), target, &revisions)?;
    render.queue(&revisions[0].key).await?;
    if let Some(parent) = revisions.get(1) {
        render.queue(&parent.key).await?;
    }
    server::serve(repository.info.clone(), revisions, render, !args.no_open).await
}

fn cache(command: CacheCommand) -> Result<()> {
    match command {
        CacheCommand::Info => {
            let (path, bytes, renders) = cache_info()?;
            println!("{}", path.display());
            println!("{renders} renders, {}", human_bytes(bytes));
        }
        CacheCommand::Clear => {
            let (path, _, _) = cache_info()?;
            clear_cache()?;
            println!("Cleared {}", path.display());
        }
    }
    Ok(())
}

fn human_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KiB", "MiB", "GiB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit + 1 < UNITS.len() {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_cache_sizes() {
        assert_eq!(human_bytes(512), "512 B");
        assert_eq!(human_bytes(2048), "2.0 KiB");
    }
}
