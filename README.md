# Typst Time Machine

Typst Time Machine turns Git or Jujutsu history into a visual document timeline.
It renders immutable revisions with the official Typst compiler, then opens a
local browser where revisions can be scrubbed, pinned, blinked, wiped, overlaid,
or compared as a pixel heatmap.

## Why

Source diffs explain what text changed. They do not show the resulting line
wraps, page breaks, spacing, figures, or visual hierarchy. Typst Time Machine
keeps version-control history read-only and makes rendered change the primary
object.

## Requirements

- Typst 0.15 or newer
- Git
- Jujutsu when opening a JJ repository
- macOS or Linux

The released `ttm` binary contains the browser frontend. Bun is needed only when
building the frontend from source.

## Install

From a checkout:

```sh
cargo install --path .
```

After publication:

```sh
cargo install typst-time-machine
```

## Use

Open a document from its repository:

```sh
ttm view manuscript/main.typ
```

Useful options:

```text
ttm view <entry.typ>
  --root <repo-relative-dir>
  --vcs auto|git|jj
  --at <revision>
  --limit <count>
  --history-path <path>
  --input <key=value>
  --font-path <dir>
  --package-path <dir>
  --package-cache-path <dir>
  --typst <binary>
  --no-open
```

`auto` prefers JJ when `.jj` and `.git` coexist. Git starts at `HEAD`; JJ pins
one operation and starts at `@-`, excluding the working-copy commit and
unsnapshotted filesystem state.

The viewer initially renders the latest revision and its parent. Other revisions
render only when selected or immediately neighboring the selection, so a cold
click is not buried behind bulk background work. The revision scrubber travels
through the loaded history. The history dock switches between the horizontal
first-parent story and a vertically scrollable reachable revision tree. Arrow
keys scrub the active view. Space temporarily shows revision A in Blink mode,
and Wipe mode can be dragged directly on the document.

Inspect or clear cached render artifacts:

```sh
ttm cache info
ttm cache clear
```

## Saved targets

Place `.typst-time-machine.toml` at repository root:

```toml
default_target = "resume"

[targets.resume]
entry = "applications/esa-ai-data-science.typ"
root = "."
history_paths = ["applications", "resume.typ", "resume-layout.typ"]
font_paths = []
inputs = { variant = "base" }
```

Then run:

```sh
ttm view --target resume
```

CLI values override target values. Configuration is optional and never created
automatically. Without `history_paths`, first-parent and full-tree histories are
loaded up to `--limit`; byte-identical first-parent output is marked and can be
collapsed inside the viewer.

## Safety and fidelity

- No checkout, Git worktree, JJ workspace, stash, working-copy snapshot, or
  repository operation is created.
- JJ commands run against one pinned operation. Full commit IDs are identities;
  change IDs are display metadata.
- Git objects are exported through a temporary index into isolated directories.
- Historical symlinks resolving outside the snapshot are rejected.
- Missing entrypoints and compiler failures affect one revision, not the session.
- Partial-clone, LFS, and submodule data is never fetched automatically.
- The server binds a random loopback port and requires a random capability path.
- SVG pages are served as images; arbitrary filesystem paths are never exposed.
- The app has no telemetry or browser-side network access. Typst itself may
  download a missing package through its normal package resolution.

Cache entries include the full commit ID, compiler identity, Typst arguments,
font inventory, project root, entrypoint, and revision timestamp.

## Development

```sh
bun install
bun run build
scripts/check
```

Source layout:

- `src/history.rs`: Git/JJ discovery, operation pinning, immutable extraction
- `src/render.rs`: Typst compiler, content-addressed cache, render scheduler
- `src/server.rs`: capability-scoped loopback API and embedded frontend
- `web/src`: framework-free TypeScript comparison interface

The frontend uses direct SVG for document pages. Only the selected pair is
rasterized for heatmaps, inside a Web Worker. Tinymist partial rendering is not
used: it still compiles the full document and exposes an experimental
version-coupled preview protocol.

## Current limits

- The revision tree is limited by `--limit` and shows reachable ancestors, not
  unrelated repository heads
- Historical committed revisions only
- Git-backed JJ repositories
- Fixed entrypoint path; renamed historical entrypoints are not guessed
- Physical page-number pairing with manual A/B selectors
- No source editor, CI snapshot manager, or publishing

## License

MIT
