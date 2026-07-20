import {
  alignPages,
  findAlignedPair,
  layoutRevisionGraph,
  outputsMatch,
  phaseLabel,
  selectionForAlignedPair,
  shortId,
  type HistoryMode,
  type PageAlignment,
  type PagePair,
  type RenderStatus,
  type Revision,
  type Session,
} from "./model";
import { LatestFrameScheduler, LeadingLatestThrottle } from "./scrubber";

type CompareMode = "single" | "side" | "blink" | "opacity" | "wipe" | "heatmap";

const tokenBase = location.pathname.replace(/\/$/, "");
const worker = new Worker(`${tokenBase}/diff-worker.js`, { type: "module" });
const root = required<HTMLElement>("#app");
const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "2-digit",
});

let session: Session;
let revisionByKeyIndex = new Map<string, Revision>();
let revisionIndexByKey = new Map<string, number>();
let revisionByCommit = new Map<string, Revision>();
let firstParentPosition = new Map<string, number>();
let selectedB = 0;
let previewedB = 0;
let pinnedA = 1;
let pageA = 0;
let pageB = 0;
let pairingAnchor: "left" | "right" = "right";
let mode: CompareMode = "single";
let historyMode: HistoryMode = "first-parent";
let mix = 50;
let collapseUnchanged = false;
let blinkHeld = false;
let heatmapGeneration = 0;
let draggingWipe = false;
let previewGeneration = 0;
let focusGeneration = 0;
const imagePreloads = new Map<string, Promise<void>>();
const scrubSelection = new LatestFrameScheduler<number>((index) => {
  selectRevision(index, false);
});
const focusRequests = new LeadingLatestThrottle<{
  revisionKey: string;
  pinnedRevisionKey: string;
  historyMode: HistoryMode;
  generation: number;
}>(50, (focus) => {
  void fetch(`${tokenBase}/api/focus`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      revision_key: focus.revisionKey,
      pinned_revision_key: focus.pinnedRevisionKey,
      history_mode: focus.historyMode,
      generation: focus.generation,
    }),
  });
});

worker.addEventListener("error", (event) => {
  const label = document.querySelector<HTMLElement>("#heatmap-label");
  if (label) label.textContent = `Could not calculate heatmap: ${event.message}`;
});

void boot();

async function boot() {
  root.innerHTML = `<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>`;
  const response = await fetch(`${tokenBase}/api/session`);
  if (!response.ok) throw new Error("Could not load Typst history.");
  session = (await response.json()) as Session;
  revisionByKeyIndex = new Map(session.revisions.map((revision) => [revision.key, revision]));
  revisionIndexByKey = new Map(session.revisions.map((revision, index) => [revision.key, index]));
  revisionByCommit = new Map(session.revisions.map((revision) => [revision.commit_id, revision]));
  firstParentPosition = new Map(session.history.first_parent_keys.map((key, index) => [key, index]));
  selectedB = revisionIndex(session.history.first_parent_keys[0]);
  previewedB = selectedB;
  pinnedA = revisionIndex(session.history.first_parent_keys[1] ?? session.history.first_parent_keys[0]);
  renderShell();
  connectEvents();
  focusVisible(true);
}

function renderShell() {
  const repoName = session.repository.root.split("/").filter(Boolean).at(-1) ?? "repository";
  root.innerHTML = `
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${escapeHtml(session.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${session.repository.kind}</span>
        <strong>${escapeHtml(repoName)}</strong>
        <span>${session.revisions.length} revisions</span>
        <span title="${escapeHtml(session.compiler)}">${escapeHtml(session.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${modeButton("single", "B")}
          ${modeButton("side", "A · B")}
          ${modeButton("blink", "Blink")}
          ${modeButton("opacity", "Mix")}
          ${modeButton("wipe", "Wipe")}
          ${modeButton("heatmap", "Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${mix}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${mix}" aria-label="Comparison position percentage" />
          <span aria-hidden="true">%</span>
        </label>
        <div class="page-controls">
          <label>A <select id="page-a" aria-label="Page for revision A"></select></label>
          <label>B <select id="page-b" aria-label="Page for revision B"></select></label>
        </div>
        <button class="pin" id="pin-a" type="button">Pin B as A</button>
        <div class="pair-suggestion" id="pair-suggestion" hidden>
          <span class="pair-confidence" id="pair-confidence" aria-hidden="true"></span>
          <p id="pair-suggestion-text" role="status" aria-live="polite" aria-atomic="true"></p>
          <button id="apply-pair" type="button"></button>
        </div>
      </section>
      <section class="document-workbench">
        <aside class="revision-note" id="revision-a" aria-label="Pinned revision A"></aside>
        <div class="stage-wrap">
          <div class="stage" id="stage" tabindex="0" aria-live="polite"></div>
          <nav class="page-rail" id="page-rail" aria-label="Document pages"></nav>
        </div>
        <aside class="revision-note" id="revision-b" aria-label="Selected revision B"></aside>
      </section>
    </main>
    <footer class="history-dock">
      <div class="history-heading">
        <div>
          <p class="eyebrow" id="history-title">First-parent history</p>
          <p id="history-description">The main story, oldest at left.</p>
        </div>
        <div class="history-actions">
          <div class="history-mode-group" role="group" aria-label="History shape">
            <button type="button" data-history-mode="first-parent" aria-pressed="true">First parent</button>
            <button type="button" data-history-mode="full-tree" aria-pressed="false">Full tree</button>
          </div>
          <label class="collapse">
            <input id="collapse" type="checkbox" />
            Hide visually unchanged
          </label>
        </div>
      </div>
      <div class="revision-scrubber">
        <label for="revision-slider">Travel through revisions</label>
        <div class="revision-track">
          <input id="revision-slider" type="range" min="0" max="0" value="0" />
          <div class="readiness-rail" id="readiness-rail" aria-label="Revision render readiness"></div>
        </div>
        <output id="revision-position"></output>
      </div>
      <div class="film" id="film" role="listbox" aria-label="Document revisions"></div>
      <div class="tree" id="tree" role="listbox" aria-label="Full revision tree" hidden></div>
    </footer>
  `;
  bindControls();
  updateAll();
}

function bindControls() {
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode as CompareMode;
      renderStage();
      updateModeControls();
      applyMix();
    });
  });
  required<HTMLInputElement>("#mix").addEventListener("input", (event) => {
    setMix(Number((event.target as HTMLInputElement).value));
  });
  required<HTMLInputElement>("#mix-number").addEventListener("input", (event) => {
    setMix(Number((event.target as HTMLInputElement).value));
  });
  required<HTMLButtonElement>("#pin-a").addEventListener("click", () => {
    previewedB = selectedB;
    pageB = Math.min(pageB, (session.revisions[previewedB].render?.pages.length ?? 1) - 1);
    const previous = pinnedA;
    pinnedA = selectedB;
    pageA = pageB;
    patchPinnedSelection(previous, pinnedA);
    updateComparison();
    focusVisible(true);
  });
  required<HTMLInputElement>("#collapse").addEventListener("change", (event) => {
    collapseUnchanged = (event.target as HTMLInputElement).checked;
    renderTimeline();
    renderRevisionScrubber();
  });
  root.querySelectorAll<HTMLButtonElement>("[data-history-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      historyMode = button.dataset.historyMode as HistoryMode;
      const keys = activeHistoryKeys();
      if (!keys.includes(session.revisions[selectedB].key)) {
        selectedB = revisionIndex(keys[0]);
        pageB = 0;
      }
      scrubSelection.cancel();
      previewGeneration += 1;
      previewedB = selectedB;
      updateAll();
      focusVisible(true);
    });
  });
  required<HTMLInputElement>("#revision-slider").addEventListener("input", (event) => {
    const keys = [...visibleHistoryKeys()].reverse();
    const key = keys[Number((event.target as HTMLInputElement).value)];
    if (key) scrubSelection.schedule(revisionIndex(key));
  });
  required<HTMLInputElement>("#revision-slider").addEventListener("change", (event) => {
    void event;
    scrubSelection.flush();
    focusVisible(true);
  });
  required<HTMLSelectElement>("#page-a").addEventListener("change", (event) => {
    pageA = Number((event.target as HTMLSelectElement).value);
    pairingAnchor = "left";
    renderStage();
    renderPagePairing();
    renderPageRail();
  });
  required<HTMLSelectElement>("#page-b").addEventListener("change", (event) => {
    pageB = Number((event.target as HTMLSelectElement).value);
    pairingAnchor = "right";
    renderStage();
    renderPagePairing();
    renderPageRail();
  });
  required<HTMLButtonElement>("#apply-pair").addEventListener("click", () => {
    const pair = suggestedPairForCurrentPage();
    const selection = pair ? selectionForAlignedPair(pair) : null;
    if (!selection) return;
    pageA = selection.pageA;
    pageB = selection.pageB;
    updateComparison();
  });
  const stage = required<HTMLElement>("#stage");
  stage.addEventListener("pointerdown", (event) => {
    if (mode === "blink") {
      blinkHeld = true;
      renderStage();
    } else if (mode === "wipe" && event.button === 0) {
      draggingWipe = true;
      stage.setPointerCapture(event.pointerId);
      setMixFromPointer(event);
    }
  });
  stage.addEventListener("pointermove", (event) => {
    if (draggingWipe) setMixFromPointer(event);
  });
  stage.addEventListener("pointerup", (event) => {
    if (draggingWipe) {
      draggingWipe = false;
      stage.releasePointerCapture(event.pointerId);
    }
  });
  window.addEventListener("pointerup", () => {
    if (blinkHeld) {
      blinkHeld = false;
      renderStage();
    }
    draggingWipe = false;
  });
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === "ArrowLeft") {
      selectRelative(1);
    } else if (event.key === "ArrowRight") {
      selectRelative(-1);
    } else if (event.code === "Space" && mode === "blink" && !event.repeat) {
      event.preventDefault();
      blinkHeld = true;
      renderStage();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space" && blinkHeld) {
      blinkHeld = false;
      renderStage();
    }
  });
}

function connectEvents() {
  const events = new EventSource(`${tokenBase}/api/events`);
  events.addEventListener("render", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as { status: RenderStatus };
    const revision = revisionByKeyIndex.get(payload.status.revision_key);
    if (!revision) return;
    revision.render = payload.status;
    updateRenderedRevision(revision);
    if (payload.status.phase === "ready") preloadNeighborPages();
  });
  events.onerror = () => {
    document.body.dataset.connection = "lost";
  };
}

function updateAll() {
  normalizePageSelection();
  renderRevisionNotes();
  renderPageSelectors();
  renderPagePairing();
  renderTimeline();
  renderRevisionScrubber();
  renderPageRail();
  renderStage();
  applyMix();
  updateModeControls();
  updateHistoryControls();
}

function updateModeControls() {
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  const mixControl = required<HTMLElement>(".mix-control");
  const mixVisible = mode === "opacity" || mode === "wipe";
  mixControl.dataset.visible = String(mixVisible);
  mixControl.hidden = !mixVisible;
  required<HTMLElement>("#mix-label").textContent = mode === "opacity" ? "Blend" : "Wipe";
}

function updateHistoryControls() {
  root.querySelectorAll<HTMLButtonElement>("[data-history-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.historyMode === historyMode));
  });
  const collapse = required<HTMLInputElement>("#collapse");
  collapse.disabled = historyMode === "full-tree";
  required<HTMLElement>("#history-title").textContent =
    historyMode === "first-parent" ? "First-parent history" : "Full revision tree";
  required<HTMLElement>("#history-description").textContent =
    historyMode === "first-parent"
      ? "The main story, oldest at left."
      : "Newest at top, with branches and merges at left.";
}

function updateRenderedRevision(revision: Revision) {
  patchHistoryRevision(revision);
  const position = firstParentPosition.get(revision.key);
  if (position != null && position > 0) {
    patchHistoryRevision(revisionByKey(session.history.first_parent_keys[position - 1]));
  }
  if (collapseUnchanged && historyMode === "first-parent" && revision.render?.phase === "ready") {
    renderTimeline();
    renderRevisionScrubber();
  }

  const previewed = session.revisions[previewedB];
  const index = revisionIndex(revision.key);
  const finalPhase = ["ready", "entrypoint_missing", "error"].includes(revision.render?.phase ?? "");
  if (index === selectedB && finalPhase) {
    void previewRevision(index);
    return;
  }
  const comparisonChanged =
    index === previewedB ||
    index === pinnedA ||
    previewed.parent_ids[0] === revision.commit_id;
  if (comparisonChanged && finalPhase) updateComparison();
}

function patchHistoryRevision(revision: Revision) {
  root
    .querySelectorAll<HTMLElement>(`[data-revision-key="${revision.key}"]`)
    .forEach((element) => {
      element.dataset.phase = revision.render?.phase ?? "idle";
      if (element.classList.contains("frame")) {
        const position = firstParentPosition.get(revision.key);
        const olderKey = position == null ? undefined : session.history.first_parent_keys[position + 1];
        const unchanged = outputsMatch(revision.render, olderKey ? revisionByKey(olderKey).render : undefined);
        const metadata = element.querySelector<HTMLElement>(".frame-meta");
        if (metadata) {
          metadata.textContent = `${shortId(revision.commit_id)} · ${
            unchanged ? "same output" : phaseLabel(revision.render)
          }`;
        }
      }
      const treeMetadata = element.querySelector<HTMLElement>(".tree-meta");
      if (treeMetadata) {
        treeMetadata.textContent = `${shortId(revision.commit_id)} · ${phaseLabel(revision.render)}`;
      }
    });
  root
    .querySelectorAll<HTMLElement>(`[data-ready-key="${revision.key}"]`)
    .forEach((segment) => {
      segment.dataset.phase = revision.render?.phase ?? "idle";
      segment.title = `${revision.subject || "(no description)"} · ${phaseLabel(revision.render)}`;
    });
}

function updateComparison() {
  normalizePageSelection();
  renderRevisionNotes();
  renderPageSelectors();
  renderPagePairing();
  renderPageRail();
  renderStage();
  applyMix();
}

function patchPinnedSelection(previous: number, current: number) {
  patchSelectionClass(previous, "pinned", false);
  patchSelectionClass(current, "pinned", true);
}

function patchSelectedRevision(previous: number, current: number, recenter: boolean) {
  patchSelectionClass(previous, "selected", false);
  patchSelectionClass(current, "selected", true);
  root.querySelectorAll<HTMLElement>(`[data-index="${previous}"]`).forEach((element) => {
    element.setAttribute("aria-selected", "false");
  });
  root.querySelectorAll<HTMLElement>(`[data-index="${current}"]`).forEach((element) => {
    element.setAttribute("aria-selected", "true");
  });
  if (!recenter) return;
  const selected = root.querySelector<HTMLElement>(`[data-index="${current}"]`);
  if (selected && historyMode === "full-tree") {
    const tree = required<HTMLElement>("#tree");
    tree.scrollTop = Math.max(0, selected.offsetTop - tree.clientHeight / 2 + selected.clientHeight / 2);
  } else if (selected) {
    const film = required<HTMLElement>("#film");
    film.scrollLeft = Math.max(0, selected.offsetLeft - film.clientWidth / 2 + selected.clientWidth / 2);
  }
}

function patchSelectionClass(index: number, className: string, enabled: boolean) {
  root.querySelectorAll<HTMLElement>(`[data-index="${index}"]`).forEach((element) => {
    element.classList.toggle(className, enabled);
  });
}

function renderRevisionNotes() {
  renderRevisionNote(required("#revision-a"), session.revisions[pinnedA], "A", pinnedA === previewedB);
  renderRevisionNote(required("#revision-b"), session.revisions[previewedB], "B", false);
}

function renderRevisionNote(container: HTMLElement, revision: Revision, letter: string, same: boolean) {
  const date = fullDateFormatter.format(new Date(revision.committed_at));
  container.innerHTML = `
    <div class="revision-letter">${letter}</div>
    <p class="revision-date">${date}</p>
    <h2>${escapeHtml(revision.subject || "(no description)")}</h2>
    <p class="revision-author">${escapeHtml(revision.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${revision.commit_id}">${shortId(revision.commit_id)}</dd></div>
      ${
        revision.change_id
          ? `<div><dt>Change</dt><dd title="${revision.change_id}">${shortId(revision.change_id)}</dd></div>`
          : ""
      }
      <div><dt>Render</dt><dd>${phaseLabel(revision.render)}</dd></div>
    </dl>
    ${revision.bookmarks.map((name) => `<span class="bookmark">${escapeHtml(name)}</span>`).join("")}
    ${same ? `<p class="same-pin">A and B are this revision.</p>` : ""}
  `;
}

function renderTimeline() {
  const film = required<HTMLElement>("#film");
  const tree = required<HTMLElement>("#tree");
  film.hidden = historyMode !== "first-parent";
  tree.hidden = historyMode !== "full-tree";
  if (historyMode === "full-tree") {
    renderTree(tree);
    return;
  }

  const previousScroll = film.scrollLeft;
  const selectedKey = session.revisions[selectedB].key;
  const selectionChanged = film.dataset.selectedKey !== selectedKey;
  const keys = visibleHistoryKeys();
  const visible = keys
    .map((key) => ({ revision: revisionByKey(key), index: revisionIndex(key) }))
    .reverse();
  film.innerHTML = visible
    .map(({ revision, index }) => {
      const phase = revision.render?.phase ?? "idle";
      const sequenceIndex = firstParentPosition.get(revision.key) ?? -1;
      const olderKey = session.history.first_parent_keys[sequenceIndex + 1];
      const older = olderKey ? revisionByKey(olderKey) : undefined;
      const unchanged = outputsMatch(revision.render, older?.render);
      return `
        <button
          class="frame ${index === selectedB ? "selected" : ""} ${index === pinnedA ? "pinned" : ""}"
          type="button"
          role="option"
          aria-selected="${index === selectedB}"
          data-index="${index}"
          data-revision-key="${revision.key}"
          data-phase="${phase}"
          title="${escapeHtml(revision.changed_paths.join("\n"))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${shortDate(revision.committed_at)}</time>
          <strong>${escapeHtml(revision.subject || "(no description)")}</strong>
          <span class="frame-meta">${shortId(revision.commit_id)} · ${unchanged ? "same output" : phaseLabel(revision.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `;
    })
    .join("");
  film.querySelectorAll<HTMLButtonElement>(".frame").forEach((button) => {
    button.addEventListener("click", () => selectRevision(Number(button.dataset.index)));
  });
  const selected = film.querySelector<HTMLElement>(".selected");
  film.dataset.selectedKey = selectedKey;
  if (selected && selectionChanged) {
    film.scrollLeft = Math.max(0, selected.offsetLeft - film.clientWidth / 2 + selected.clientWidth / 2);
  } else {
    film.scrollLeft = previousScroll;
  }
}

function renderTree(tree: HTMLElement) {
  const keys = session.history.full_tree_keys;
  const graph = layoutRevisionGraph(session.revisions, keys);
  const nodes = new Map(graph.nodes.map((node) => [node.key, node]));
  const previousScroll = tree.scrollTop;
  const selectedKey = session.revisions[selectedB].key;
  const selectionChanged = tree.dataset.selectedKey !== selectedKey;
  const rowHeight = 58;
  const insetY = 8;
  const visibleLanes = Math.min(8, graph.laneCount);
  const railWidth = 34 + visibleLanes * 18;
  const laneX = (lane: number) =>
    graph.laneCount < 2 ? 18 : 16 + (lane / (graph.laneCount - 1)) * (railWidth - 32);
  const height = keys.length * rowHeight + insetY * 2;
  const rowByKey = new Map(graph.nodes.map((node) => [node.key, node.row]));
  const edges = graph.edges
    .map((edge) => {
      const child = nodes.get(edge.child);
      const parent = nodes.get(edge.parent);
      if (!child || !parent) return "";
      const childRow = rowByKey.get(edge.child);
      const parentRow = rowByKey.get(edge.parent);
      if (childRow == null || parentRow == null) return "";
      const x1 = laneX(child.lane);
      const y1 = insetY + childRow * rowHeight + rowHeight / 2;
      const x2 = laneX(parent.lane);
      const y2 = insetY + parentRow * rowHeight + rowHeight / 2;
      const bend = (y1 + y2) / 2;
      return `<path class="${edge.merge ? "merge-edge" : ""}" d="M ${x1} ${y1} C ${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}" />`;
    })
    .join("");
  const dots = graph.nodes
    .map((node) => {
      const row = rowByKey.get(node.key);
      if (row == null) return "";
      const index = revisionIndex(node.key);
      const classes = [
        index === selectedB ? "selected" : "",
        index === pinnedA ? "pinned" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<circle class="${classes}" cx="${laneX(node.lane)}" cy="${insetY + row * rowHeight + rowHeight / 2}" r="5" />`;
    })
    .join("");
  const cards = graph.nodes
    .map((node) => {
      const revision = revisionByKey(node.key);
      const index = revisionIndex(node.key);
      const phase = revision.render?.phase ?? "idle";
      return `
        <button
          class="tree-node ${index === selectedB ? "selected" : ""} ${index === pinnedA ? "pinned" : ""}"
          type="button"
          role="option"
          aria-selected="${index === selectedB}"
          data-index="${index}"
          data-revision-key="${revision.key}"
          data-phase="${phase}"
          title="${escapeHtml(revision.changed_paths.join("\n"))}"
        >
          <span class="tree-subject">
            <strong>${escapeHtml(revision.subject || "(no description)")}</strong>
            <time>${shortDate(revision.committed_at)}</time>
          </span>
          <span class="tree-meta">${shortId(revision.commit_id)} · ${phaseLabel(revision.render)}</span>
        </button>
      `;
    })
    .join("");
  tree.innerHTML = `
    <div class="tree-canvas" data-lanes="${visibleLanes}">
      <svg aria-hidden="true" viewBox="0 0 ${railWidth} ${height}" width="${railWidth}" height="${height}">${edges}${dots}</svg>
      ${cards}
    </div>
  `;
  tree.querySelectorAll<HTMLButtonElement>(".tree-node").forEach((button) => {
    button.addEventListener("click", () => selectRevision(Number(button.dataset.index)));
  });
  const selected = tree.querySelector<HTMLElement>(".tree-node.selected");
  tree.dataset.selectedKey = selectedKey;
  if (selected && selectionChanged) {
    tree.scrollTop = Math.max(0, selected.offsetTop - tree.clientHeight / 2 + selected.clientHeight / 2);
  } else {
    tree.scrollTop = previousScroll;
  }
}

function renderRevisionScrubber(syncControl = true) {
  const keys = [...visibleHistoryKeys()].reverse();
  const slider = required<HTMLInputElement>("#revision-slider");
  const selectedKey = session.revisions[selectedB].key;
  const position = Math.max(0, keys.indexOf(selectedKey));
  slider.max = String(Math.max(0, keys.length - 1));
  if (syncControl) slider.value = String(position);
  const revision = keys[position] ? revisionByKey(keys[position]) : undefined;
  required<HTMLOutputElement>("#revision-position").textContent = revision
    ? `${position + 1} / ${keys.length} · ${shortDate(revision.committed_at)} · ${revision.subject || "(no description)"}`
    : "No revision";
  renderReadinessRail(keys);
}

function renderReadinessRail(keys: string[]) {
  const rail = required<HTMLElement>("#readiness-rail");
  const identity = keys.join("\0");
  if (rail.dataset.keys !== identity) {
    rail.dataset.keys = identity;
    rail.innerHTML = keys
      .map((key) => {
        const revision = revisionByKey(key);
        return `<span
          data-ready-key="${revision.key}"
          data-phase="${revision.render?.phase ?? "idle"}"
          title="${escapeHtml(`${revision.subject || "(no description)"} · ${phaseLabel(revision.render)}`)}"
        ></span>`;
      })
      .join("");
  }
  const selectedKey = session.revisions[selectedB].key;
  rail.querySelectorAll<HTMLElement>("[data-ready-key]").forEach((segment) => {
    const key = segment.dataset.readyKey;
    const revision = key ? revisionByKey(key) : undefined;
    segment.dataset.phase = revision?.render?.phase ?? "idle";
    segment.classList.toggle("selected", key === selectedKey);
  });
}

function renderPageSelectors() {
  fillPageSelect(required("#page-a"), session.revisions[pinnedA].render, pageA);
  fillPageSelect(required("#page-b"), session.revisions[previewedB].render, pageB);
}

function fillPageSelect(select: HTMLSelectElement, status: RenderStatus | undefined, selected: number) {
  const count = status?.phase === "ready" ? status.pages.length : 0;
  if (count === 0) {
    select.innerHTML = `<option value="0">—</option>`;
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = Array.from(
    { length: count },
    (_, index) => `<option value="${index}" ${index === selected ? "selected" : ""}>${index + 1}</option>`,
  ).join("");
}

function currentPageAlignment(): PageAlignment {
  const left = session.revisions[pinnedA].render;
  const right = session.revisions[previewedB].render;
  return alignPages(
    left?.phase === "ready" ? left.pages : [],
    right?.phase === "ready" ? right.pages : [],
  );
}

function suggestedPairForCurrentPage(alignment = currentPageAlignment()): PagePair | null {
  if (!alignment.shifted) return null;
  return findAlignedPair(
    alignment,
    pairingAnchor,
    pairingAnchor === "left" ? pageA : pageB,
  );
}

function normalizePageSelection() {
  const left = session.revisions[pinnedA].render;
  const right = session.revisions[previewedB].render;
  if (left?.phase === "ready" && left.pages.length > 0) {
    pageA = Math.min(pageA, left.pages.length - 1);
  }
  if (right?.phase === "ready" && right.pages.length > 0) {
    pageB = Math.min(pageB, right.pages.length - 1);
  }
}

function renderPagePairing() {
  const container = required<HTMLElement>("#pair-suggestion");
  const confidence = required<HTMLElement>("#pair-confidence");
  const text = required<HTMLElement>("#pair-suggestion-text");
  const apply = required<HTMLButtonElement>("#apply-pair");
  if (selectedB !== previewedB) {
    container.hidden = true;
    return;
  }
  const alignment = currentPageAlignment();
  const pair = suggestedPairForCurrentPage(alignment);
  const selection = pair ? selectionForAlignedPair(pair) : null;
  if (pair && !selection) {
    container.hidden = false;
    container.dataset.confidence = "unpaired";
    confidence.hidden = true;
    apply.hidden = true;
    text.textContent =
      pair.rightIndex != null
        ? `B ${pair.rightIndex + 1} has no reliable A pair. Choose pages manually.`
        : `A ${(pair.leftIndex ?? 0) + 1} has no reliable B pair. Choose pages manually.`;
    return;
  }
  if (!pair?.confidence || !selection || pair.leftIndex === pair.rightIndex) {
    const left = session.revisions[pinnedA].render;
    const right = session.revisions[previewedB].render;
    const unequalReadyPages =
      left?.phase === "ready" &&
      right?.phase === "ready" &&
      left.pages.length !== right.pages.length;
    if (unequalReadyPages && !alignment.shifted) {
      container.hidden = false;
      container.dataset.confidence = "unpaired";
      confidence.hidden = true;
      apply.hidden = true;
      text.textContent = "Could not align these pages reliably. Choose A and B manually.";
      return;
    }
    container.hidden = true;
    container.removeAttribute("data-confidence");
    return;
  }

  const leftPage = pair.leftIndex + 1;
  const rightPage = pair.rightIndex + 1;
  const applied = pageA === pair.leftIndex && pageB === pair.rightIndex;
  container.hidden = false;
  container.dataset.confidence = pair.confidence;
  confidence.hidden = false;
  confidence.textContent = `${pair.confidence} confidence`;
  text.textContent = applied
    ? `Aligned pair: A ${leftPage} with B ${rightPage}.`
    : `Likely page shift: A ${leftPage} matches B ${rightPage}.`;
  apply.hidden = applied;
  apply.textContent = `Use A ${leftPage} / B ${rightPage}`;
  apply.setAttribute("aria-label", `Use A page ${leftPage} and B page ${rightPage}`);
}

function renderPageRail() {
  const alignment = currentPageAlignment();
  const rail = required<HTMLElement>("#page-rail");
  rail.innerHTML = alignment.pairs
    .map((pair) => {
      const leftPage = pair.leftIndex == null ? null : pair.leftIndex + 1;
      const rightPage = pair.rightIndex == null ? null : pair.rightIndex + 1;
      const active = pair.leftIndex === pageA && pair.rightIndex === pageB;
      const shifted = leftPage != null && rightPage != null && leftPage !== rightPage;
      const label = shifted
        ? `<span>A${leftPage}</span><span>B${rightPage}</span>`
        : String(rightPage ?? leftPage ?? "—");
      const description = pagePairDescription(pair);
      if (pair.leftIndex == null || pair.rightIndex == null) {
        return `<span
          class="page-tick ${pair.relation} unpaired"
          aria-label="${escapeHtml(description)}"
        >${label}</span>`;
      }
      return `<button
        type="button"
        class="page-tick ${pair.relation} ${active ? "active" : ""} ${shifted ? "shifted" : ""}"
        data-page-a="${pair.leftIndex}"
        data-page-b="${pair.rightIndex}"
        aria-pressed="${active}"
        aria-label="${escapeHtml(description)}"
      >${label}</button>`;
    })
    .join("");
  rail.querySelectorAll<HTMLButtonElement>(".page-tick").forEach((button) => {
    button.addEventListener("click", () => {
      const leftIndex = button.dataset.pageA;
      const rightIndex = button.dataset.pageB;
      if (leftIndex == null || rightIndex == null) return;
      pageA = Number(leftIndex);
      pageB = Number(rightIndex);
      pairingAnchor = "right";
      updateComparison();
    });
  });
}

function pagePairDescription(pair: PagePair): string {
  const confidence = pair.confidence ? `, ${pair.confidence} confidence` : "";
  if (pair.leftIndex == null && pair.rightIndex != null) {
    return `B page ${pair.rightIndex + 1} has no reliable A pair`;
  }
  if (pair.rightIndex == null && pair.leftIndex != null) {
    return `A page ${pair.leftIndex + 1} has no reliable B pair`;
  }
  return `Use A page ${(pair.leftIndex ?? 0) + 1} and B page ${(pair.rightIndex ?? 0) + 1}, ${pair.relation}${confidence}`;
}

function renderStage() {
  const stage = required<HTMLElement>("#stage");
  const leftRevision = session.revisions[pinnedA];
  const rightRevision = session.revisions[previewedB];
  const left = pageUrl(leftRevision.render, pageA);
  const right = pageUrl(rightRevision.render, pageB);

  ensureStageStructure(stage);
  if (mode === "heatmap") {
    const comparison = `${left ?? "missing"}\0${right ?? "missing"}`;
    if (left && right && stage.dataset.comparison !== comparison) {
      stage.dataset.comparison = comparison;
      const label = required<HTMLElement>("#heatmap-label");
      label.textContent = "Calculating visual difference…";
      void buildHeatmap(left, right);
    }
    return;
  }

  patchPageSlot(stage.querySelector<HTMLElement>('[data-page-slot="a"]'), leftRevision, left, "A");
  patchPageSlot(stage.querySelector<HTMLElement>('[data-page-slot="b"]'), rightRevision, right, "B");
  const blinkPages = stage.querySelector<HTMLElement>(".blink-pages");
  blinkPages?.classList.toggle("show-a", blinkHeld);
  blinkPages?.classList.toggle("show-b", !blinkHeld);
  const same = stage.querySelector<HTMLElement>(".same-output");
  if (same) same.hidden = !outputMatchesFirstParent(rightRevision);
}

function ensureStageStructure(stage: HTMLElement) {
  if (stage.dataset.mode === mode) return;
  stage.dataset.mode = mode;
  stage.dataset.comparison = "";
  if (mode === "single") {
    stage.innerHTML = `
      <div class="single-page">
        ${pageSlot("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;
  } else if (mode === "side") {
    stage.innerHTML = `<div class="split-pages">${pageSlot("a")}${pageSlot("b")}</div>`;
  } else if (mode === "blink") {
    stage.innerHTML = `
      <div class="stack-pages blink-pages show-b">
        ${pageSlot("a")}
        ${pageSlot("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;
  } else if (mode === "opacity") {
    stage.innerHTML = `
      <div class="stack-pages">
        ${pageSlot("a")}
        <div class="overlay-page mix-page">${pageSlot("b")}</div>
      </div>
    `;
  } else if (mode === "wipe") {
    stage.innerHTML = `
      <div class="stack-pages wipe-pages">
        ${pageSlot("a")}
        <div class="overlay-page wipe">${pageSlot("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;
  } else {
    stage.innerHTML = `<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>`;
  }
}

function pageSlot(key: "a" | "b"): string {
  const label = key.toUpperCase();
  return `
    <div class="page-slot" data-page-slot="${key}">
      <img class="document-page" alt="Revision ${label}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${label}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `;
}

function patchPageSlot(
  slot: HTMLElement | null,
  revision: Revision,
  url: string | null,
  label: "A" | "B",
) {
  if (!slot) return;
  const image = slot.querySelector<HTMLImageElement>("img");
  const status = slot.querySelector<HTMLElement>(".render-status");
  if (!image || !status) return;
  if (url) {
    if (image.getAttribute("src") !== url) image.src = url;
    image.hidden = false;
    status.hidden = true;
    return;
  }
  image.hidden = true;
  status.hidden = false;
  status.className = `render-status ${revision.render?.phase ?? "idle"}`;
  const strong = status.querySelector<HTMLElement>("strong");
  const message = status.querySelector<HTMLElement>("p");
  if (strong) strong.textContent = phaseLabel(revision.render);
  if (message) {
    message.textContent =
      revision.render?.message ??
      (revision.render?.phase ? "Preparing this revision…" : `Select revision ${label} to render it.`);
  }
}

function setMix(value: number) {
  if (!Number.isFinite(value)) return;
  mix = Math.min(100, Math.max(0, Math.round(value)));
  applyMix();
}

function applyMix() {
  const range = document.querySelector<HTMLInputElement>("#mix");
  const number = document.querySelector<HTMLInputElement>("#mix-number");
  if (range) range.value = String(mix);
  if (number) number.value = String(mix);
  holdStyle(document.querySelector<HTMLElement>(".mix-page"), { opacity: mix / 100 });
  holdStyle(document.querySelector<HTMLElement>(".wipe"), {
    clipPath: `inset(0 ${100 - mix}% 0 0)`,
  });
  holdStyle(document.querySelector<HTMLElement>(".wipe-line"), { left: `${mix}%` });
  holdStyle(document.querySelector<HTMLElement>(".wipe-handle"), { left: `${mix}%` });
}

function holdStyle(element: HTMLElement | null, frame: Keyframe) {
  if (!element) return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate([frame, frame], { duration: 1, fill: "forwards" });
}

function setMixFromPointer(event: PointerEvent) {
  const pages = document.querySelector<HTMLElement>(".wipe-pages");
  if (!pages) return;
  const bounds = pages.getBoundingClientRect();
  setMix(((event.clientX - bounds.left) / bounds.width) * 100);
}

async function buildHeatmap(leftUrl: string, rightUrl: string) {
  const generation = ++heatmapGeneration;
  let left: ImageBitmap;
  let right: ImageBitmap;
  try {
    [left, right] = await Promise.all([loadBitmap(leftUrl), loadBitmap(rightUrl)]);
  } catch (error) {
    if (generation === heatmapGeneration && mode === "heatmap") {
      const label = document.querySelector<HTMLElement>("#heatmap-label");
      if (label) label.textContent = `Could not calculate heatmap: ${String(error)}`;
    }
    return;
  }
  if (generation !== heatmapGeneration || mode !== "heatmap") {
    left.close();
    right.close();
    return;
  }
  worker.onmessage = (event: MessageEvent) => {
    const result = event.data as {
      bitmap: ImageBitmap;
      width: number;
      height: number;
      changed: number;
      total: number;
      generation: number;
    };
    if (result.generation !== heatmapGeneration || mode !== "heatmap") {
      result.bitmap.close();
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>("#heatmap");
    if (!canvas) {
      result.bitmap.close();
      return;
    }
    canvas.width = result.width;
    canvas.height = result.height;
    const bitmapContext = canvas.getContext("bitmaprenderer");
    if (bitmapContext) {
      bitmapContext.transferFromImageBitmap(result.bitmap);
    } else {
      canvas.getContext("2d")!.drawImage(result.bitmap, 0, 0);
      result.bitmap.close();
    }
    const label = document.querySelector<HTMLElement>("#heatmap-label");
    if (label) label.textContent = `${((result.changed / result.total) * 100).toFixed(2)}% pixels differ`;
  };
  worker.postMessage(
    {
      left,
      right,
      scale: 1.5,
      generation,
    },
    [left, right],
  );
}

function selectRevision(index: number, recenter = true) {
  if (index < 0 || index >= session.revisions.length) return;
  const previous = selectedB;
  selectedB = index;
  patchSelectedRevision(previous, selectedB, recenter);
  renderRevisionScrubber(recenter);
  updatePreviewPending();
  focusVisible();
  void previewRevision(index);
}

async function previewRevision(index: number) {
  const revision = session.revisions[index];
  const finalPhase = ["ready", "entrypoint_missing", "error"].includes(revision.render?.phase ?? "");
  if (!finalPhase) return;
  if (index === previewedB) {
    updateComparison();
    updatePreviewPending();
    return;
  }

  const generation = ++previewGeneration;
  const pages = revision.render?.pages.length ?? 1;
  const nextPage = Math.min(pageB, pages - 1);
  const nextUrl = pageUrl(revision.render, nextPage);
  if (nextUrl) {
    try {
      await preloadImage(nextUrl);
    } catch {
      // The normal stage error handling remains the source of truth.
    }
  }
  if (generation !== previewGeneration || selectedB !== index) return;

  previewedB = index;
  pageB = nextPage;
  updateComparison();
  updatePreviewPending();
  preloadNeighborPages();
}

function preloadImage(url: string): Promise<void> {
  const cached = imagePreloads.get(url);
  if (cached) {
    imagePreloads.delete(url);
    imagePreloads.set(url, cached);
    return cached;
  }
  const image = new Image();
  image.decoding = "async";
  const pending = new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => {
      void image.decode().then(resolve, resolve);
    });
    image.addEventListener("error", () => reject(new Error(`Could not preload ${url}`)));
    image.src = url;
  }).catch((error) => {
    imagePreloads.delete(url);
    throw error;
  });
  imagePreloads.set(url, pending);
  while (imagePreloads.size > 12) {
    const oldest = imagePreloads.keys().next().value;
    if (oldest === undefined) break;
    imagePreloads.delete(oldest);
  }
  return pending;
}

function preloadNeighborPages() {
  const keys = activeHistoryKeys();
  const current = keys.indexOf(session.revisions[selectedB].key);
  for (const offset of [-2, -1, 1, 2]) {
    const key = keys[current + offset];
    if (!key) continue;
    const url = pageUrl(revisionByKey(key).render, pageB);
    if (url) void preloadImage(url).catch(() => undefined);
  }
}

function updatePreviewPending() {
  const stage = required<HTMLElement>("#stage");
  const pending = selectedB !== previewedB;
  stage.dataset.previewPending = String(pending);
  stage.setAttribute("aria-busy", String(pending));
}

function selectRelative(offset: number) {
  const keys = visibleHistoryKeys();
  const current = keys.indexOf(session.revisions[selectedB].key);
  if (current < 0) return;
  const next = Math.min(keys.length - 1, Math.max(0, current + offset));
  selectRevision(revisionIndex(keys[next]));
}

function focusVisible(immediate = false) {
  const focus = {
    revisionKey: session.revisions[selectedB].key,
    pinnedRevisionKey: session.revisions[pinnedA].key,
    historyMode,
    generation: ++focusGeneration,
  };
  focusRequests.schedule(focus);
  if (immediate) focusRequests.flush();
}

function pageUrl(status: RenderStatus | undefined, pageIndex: number): string | null {
  if (status?.phase !== "ready" || !status.render_id || !status.pages[pageIndex]) return null;
  return `${tokenBase}/assets/${status.render_id}/page/${status.pages[pageIndex].number}`;
}

function outputMatchesFirstParent(revision: Revision): boolean {
  const parent = revisionByCommit.get(revision.parent_ids[0]);
  return Boolean(parent && outputsMatch(revision.render, parent.render));
}

function modeButton(value: CompareMode, label: string): string {
  return `<button type="button" data-mode="${value}" aria-pressed="${value === mode}">${label}</button>`;
}

function activeHistoryKeys(): string[] {
  return historyMode === "first-parent"
    ? session.history.first_parent_keys
    : session.history.full_tree_keys;
}

function visibleHistoryKeys(): string[] {
  const keys = activeHistoryKeys();
  if (historyMode === "full-tree" || !collapseUnchanged) return keys;
  return keys.filter((key, index) => {
    if (index === keys.length - 1) return true;
    return !outputsMatch(revisionByKey(key).render, revisionByKey(keys[index + 1]).render);
  });
}

function revisionByKey(key: string): Revision {
  const revision = revisionByKeyIndex.get(key);
  if (!revision) throw new Error(`Unknown revision: ${key}`);
  return revision;
}

function revisionIndex(key: string): number {
  return revisionIndexByKey.get(key) ?? -1;
}

function shortDate(value: string): string {
  return shortDateFormatter.format(new Date(value));
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const candidate = new Image();
    candidate.decoding = "async";
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => reject(new Error(`Could not load ${url}`));
    candidate.src = url;
  });
  return createImageBitmap(image);
}

function required<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
