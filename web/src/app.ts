import {
  layoutRevisionGraph,
  outputsMatch,
  pageRelation,
  phaseLabel,
  shortId,
  type HistoryMode,
  type RenderStatus,
  type Revision,
  type Session,
} from "./model";

type CompareMode = "single" | "side" | "blink" | "opacity" | "wipe" | "heatmap";

const tokenBase = location.pathname.replace(/\/$/, "");
const worker = new Worker(`${tokenBase}/diff-worker.js`, { type: "module" });
const root = required<HTMLElement>("#app");

let session: Session;
let selectedB = 0;
let pinnedA = 1;
let pageA = 0;
let pageB = 0;
let mode: CompareMode = "single";
let historyMode: HistoryMode = "first-parent";
let mix = 50;
let collapseUnchanged = false;
let blinkHeld = false;
let heatmapGeneration = 0;
let backgroundTimer: number | undefined;
let draggingWipe = false;

void boot();

async function boot() {
  root.innerHTML = `<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>`;
  const response = await fetch(`${tokenBase}/api/session`);
  if (!response.ok) throw new Error("Could not load Typst history.");
  session = (await response.json()) as Session;
  selectedB = revisionIndex(session.history.first_parent_keys[0]);
  pinnedA = revisionIndex(session.history.first_parent_keys[1] ?? session.history.first_parent_keys[0]);
  renderShell();
  connectEvents();
  queueVisible();
  queueBackground();
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
        <input id="revision-slider" type="range" min="0" max="0" value="0" />
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
      updateAll();
    });
  });
  required<HTMLInputElement>("#mix").addEventListener("input", (event) => {
    setMix(Number((event.target as HTMLInputElement).value));
  });
  required<HTMLInputElement>("#mix-number").addEventListener("input", (event) => {
    setMix(Number((event.target as HTMLInputElement).value));
  });
  required<HTMLButtonElement>("#pin-a").addEventListener("click", () => {
    pinnedA = selectedB;
    pageA = pageB;
    updateAll();
    queueVisible();
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
      updateAll();
      queueVisible();
    });
  });
  required<HTMLInputElement>("#revision-slider").addEventListener("input", (event) => {
    const keys = [...visibleHistoryKeys()].reverse();
    const key = keys[Number((event.target as HTMLInputElement).value)];
    if (key) selectRevision(revisionIndex(key));
  });
  required<HTMLSelectElement>("#page-a").addEventListener("change", (event) => {
    pageA = Number((event.target as HTMLSelectElement).value);
    renderStage();
    renderPageRail();
  });
  required<HTMLSelectElement>("#page-b").addEventListener("change", (event) => {
    pageB = Number((event.target as HTMLSelectElement).value);
    renderStage();
    renderPageRail();
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
    const revision = session.revisions.find((item) => item.key === payload.status.revision_key);
    if (!revision) return;
    revision.render = payload.status;
    updateAll();
    if (payload.status.phase === "ready") {
      queueNeighbors();
      queueBackground();
    }
  });
  events.onerror = () => {
    document.body.dataset.connection = "lost";
  };
}

function updateAll() {
  renderRevisionNotes();
  renderPageSelectors();
  renderTimeline();
  renderRevisionScrubber();
  renderPageRail();
  renderStage();
  applyMix();
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  const mixControl = required<HTMLElement>(".mix-control");
  const mixVisible = mode === "opacity" || mode === "wipe";
  mixControl.dataset.visible = String(mixVisible);
  mixControl.hidden = !mixVisible;
  required<HTMLElement>("#mix-label").textContent = mode === "opacity" ? "Blend" : "Wipe";
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
      : "Branches and merges, oldest at left.";
}

function renderRevisionNotes() {
  renderRevisionNote(required("#revision-a"), session.revisions[pinnedA], "A", pinnedA === selectedB);
  renderRevisionNote(required("#revision-b"), session.revisions[selectedB], "B", false);
}

function renderRevisionNote(container: HTMLElement, revision: Revision, letter: string, same: boolean) {
  const date = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(revision.committed_at));
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

  const keys = visibleHistoryKeys();
  const visible = keys
    .map((key) => ({ revision: revisionByKey(key), index: revisionIndex(key) }))
    .reverse();
  film.innerHTML = visible
    .map(({ revision, index }) => {
      const phase = revision.render?.phase ?? "idle";
      const sequenceIndex = session.history.first_parent_keys.indexOf(revision.key);
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
  if (selected) {
    film.scrollLeft = Math.max(0, selected.offsetLeft - film.clientWidth / 2 + selected.clientWidth / 2);
  }
}

function renderTree(tree: HTMLElement) {
  const keys = session.history.full_tree_keys;
  const graph = layoutRevisionGraph(session.revisions, keys);
  const nodes = new Map(graph.nodes.map((node) => [node.key, node]));
  const stepX = 188;
  const stepY = 92;
  const insetX = 14;
  const insetY = 14;
  const nodeWidth = 166;
  const nodeHeight = 72;
  const width = Math.max(tree.clientWidth || 0, keys.length * stepX + insetX * 2);
  const height = Math.max(112, graph.laneCount * stepY + insetY * 2);
  const edges = graph.edges
    .map((edge) => {
      const child = nodes.get(edge.child);
      const parent = nodes.get(edge.parent);
      if (!child || !parent) return "";
      const x1 = insetX + child.column * stepX + nodeWidth / 2;
      const y1 = insetY + child.lane * stepY + nodeHeight / 2;
      const x2 = insetX + parent.column * stepX + nodeWidth / 2;
      const y2 = insetY + parent.lane * stepY + nodeHeight / 2;
      const bend = (x1 + x2) / 2;
      return `<path class="${edge.merge ? "merge-edge" : ""}" d="M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}" />`;
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
          style="left:${insetX + node.column * stepX}px;top:${insetY + node.lane * stepY}px"
          type="button"
          role="option"
          aria-selected="${index === selectedB}"
          data-index="${index}"
          data-phase="${phase}"
          title="${escapeHtml(revision.changed_paths.join("\n"))}"
        >
          <time>${shortDate(revision.committed_at)}</time>
          <strong>${escapeHtml(revision.subject || "(no description)")}</strong>
          <span>${shortId(revision.commit_id)} · ${phaseLabel(revision.render)}</span>
        </button>
      `;
    })
    .join("");
  tree.innerHTML = `
    <div class="tree-canvas" style="width:${width}px;height:${height}px">
      <svg aria-hidden="true" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${edges}</svg>
      ${cards}
    </div>
  `;
  tree.querySelectorAll<HTMLButtonElement>(".tree-node").forEach((button) => {
    button.addEventListener("click", () => selectRevision(Number(button.dataset.index)));
  });
  const selected = tree.querySelector<HTMLElement>(".selected");
  if (selected) {
    tree.scrollLeft = Math.max(0, selected.offsetLeft - tree.clientWidth / 2 + selected.clientWidth / 2);
    tree.scrollTop = Math.max(0, selected.offsetTop - tree.clientHeight / 2 + selected.clientHeight / 2);
  }
}

function renderRevisionScrubber() {
  const keys = [...visibleHistoryKeys()].reverse();
  const slider = required<HTMLInputElement>("#revision-slider");
  const selectedKey = session.revisions[selectedB].key;
  const position = Math.max(0, keys.indexOf(selectedKey));
  slider.max = String(Math.max(0, keys.length - 1));
  slider.value = String(position);
  slider.style.setProperty("--progress", `${keys.length < 2 ? 100 : (position / (keys.length - 1)) * 100}%`);
  const revision = keys[position] ? revisionByKey(keys[position]) : undefined;
  required<HTMLOutputElement>("#revision-position").textContent = revision
    ? `${position + 1} / ${keys.length} · ${shortDate(revision.committed_at)} · ${revision.subject || "(no description)"}`
    : "No revision";
}

function renderPageSelectors() {
  fillPageSelect(required("#page-a"), session.revisions[pinnedA].render, pageA);
  fillPageSelect(required("#page-b"), session.revisions[selectedB].render, pageB);
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

function renderPageRail() {
  const left = session.revisions[pinnedA].render;
  const right = session.revisions[selectedB].render;
  const count = Math.max(left?.pages.length ?? 0, right?.pages.length ?? 0);
  const rail = required<HTMLElement>("#page-rail");
  rail.innerHTML = Array.from({ length: count }, (_, index) => {
    const relation = pageRelation(left, right, index);
    return `<button class="page-tick ${relation} ${index === pageB ? "active" : ""}" data-page="${index}" title="Page ${index + 1}: ${relation}">${index + 1}</button>`;
  }).join("");
  rail.querySelectorAll<HTMLButtonElement>(".page-tick").forEach((button) => {
    button.addEventListener("click", () => {
      pageA = Math.min(Number(button.dataset.page), Math.max(0, (left?.pages.length ?? 1) - 1));
      pageB = Math.min(Number(button.dataset.page), Math.max(0, (right?.pages.length ?? 1) - 1));
      updateAll();
    });
  });
}

function renderStage() {
  const stage = required<HTMLElement>("#stage");
  const leftRevision = session.revisions[pinnedA];
  const rightRevision = session.revisions[selectedB];
  const left = pageUrl(leftRevision.render, pageA);
  const right = pageUrl(rightRevision.render, pageB);

  if (mode === "single") {
    stage.innerHTML = pageOrStatus(rightRevision, right, "B");
    return;
  }
  if (!left || !right) {
    stage.innerHTML = `
      <div class="split-pages">
        ${pageOrStatus(leftRevision, left, "A")}
        ${pageOrStatus(rightRevision, right, "B")}
      </div>
    `;
    return;
  }
  if (mode === "side") {
    stage.innerHTML = `<div class="split-pages">${pageImage(left, "Revision A")}${pageImage(right, "Revision B")}</div>`;
  } else if (mode === "blink") {
    stage.innerHTML = `
      <div class="stack-pages ${blinkHeld ? "show-a" : "show-b"}">
        ${pageImage(left, "Revision A")}
        ${pageImage(right, "Revision B")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;
  } else if (mode === "opacity") {
    stage.innerHTML = `
      <div class="stack-pages">
        ${pageImage(left, "Revision A")}
        <div class="overlay-page mix-page">${pageImage(right, "Revision B")}</div>
      </div>
    `;
  } else if (mode === "wipe") {
    stage.innerHTML = `
      <div class="stack-pages wipe-pages">
        ${pageImage(left, "Revision A")}
        <div class="overlay-page wipe">${pageImage(right, "Revision B")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;
  } else {
    stage.innerHTML = `<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Calculating visual difference…</p></div>`;
    void buildHeatmap(left, right);
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
  if (range) valueAndProgress(range, mix);
  if (number) number.value = String(mix);
  document.querySelector<HTMLElement>(".mix-page")?.style.setProperty("opacity", String(mix / 100));
  document.querySelector<HTMLElement>(".wipe")?.style.setProperty("clip-path", `inset(0 ${100 - mix}% 0 0)`);
  document.querySelector<HTMLElement>(".wipe-line")?.style.setProperty("left", `${mix}%`);
  document.querySelector<HTMLElement>(".wipe-handle")?.style.setProperty("left", `${mix}%`);
}

function setMixFromPointer(event: PointerEvent) {
  const pages = document.querySelector<HTMLElement>(".wipe-pages");
  if (!pages) return;
  const bounds = pages.getBoundingClientRect();
  setMix(((event.clientX - bounds.left) / bounds.width) * 100);
}

async function buildHeatmap(leftUrl: string, rightUrl: string) {
  const generation = ++heatmapGeneration;
  const [left, right] = await Promise.all([loadImage(leftUrl), loadImage(rightUrl)]);
  if (generation !== heatmapGeneration || mode !== "heatmap") return;
  const scale = 1.5;
  const width = Math.ceil(Math.max(left.naturalWidth, right.naturalWidth) * scale);
  const height = Math.ceil(Math.max(left.naturalHeight, right.naturalHeight) * scale);
  const render = (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      Math.round((width - image.naturalWidth * scale) / 2),
      Math.round((height - image.naturalHeight * scale) / 2),
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    return context.getImageData(0, 0, width, height);
  };
  const leftData = render(left);
  const rightData = render(right);
  worker.onmessage = (event: MessageEvent) => {
    if (generation !== heatmapGeneration || mode !== "heatmap") return;
    const result = event.data as {
      output: ArrayBuffer;
      width: number;
      height: number;
      changed: number;
      total: number;
    };
    const canvas = document.querySelector<HTMLCanvasElement>("#heatmap");
    if (!canvas) return;
    canvas.width = result.width;
    canvas.height = result.height;
    canvas
      .getContext("2d")!
      .putImageData(new ImageData(new Uint8ClampedArray(result.output), result.width, result.height), 0, 0);
    const label = document.querySelector<HTMLElement>("#heatmap-label");
    if (label) label.textContent = `${((result.changed / result.total) * 100).toFixed(2)}% pixels differ`;
  };
  worker.postMessage(
    {
      left: leftData.data.buffer,
      right: rightData.data.buffer,
      width,
      height,
    },
    [leftData.data.buffer, rightData.data.buffer],
  );
}

function selectRevision(index: number) {
  if (index < 0 || index >= session.revisions.length) return;
  selectedB = index;
  const pages = session.revisions[index].render?.pages.length ?? 1;
  pageB = Math.min(pageB, pages - 1);
  updateAll();
  queueVisible();
}

function selectRelative(offset: number) {
  const keys = activeHistoryKeys();
  const current = keys.indexOf(session.revisions[selectedB].key);
  if (current < 0) return;
  const next = Math.min(keys.length - 1, Math.max(0, current + offset));
  selectRevision(revisionIndex(keys[next]));
}

function queueVisible() {
  void queueRevision(session.revisions[selectedB]);
  void queueRevision(session.revisions[pinnedA]);
  queueNeighbors();
}

function queueNeighbors() {
  const keys = activeHistoryKeys();
  const current = keys.indexOf(session.revisions[selectedB].key);
  for (const position of [current - 1, current + 1]) {
    if (position >= 0 && position < keys.length) void queueRevision(revisionByKey(keys[position]));
  }
}

function queueBackground() {
  window.clearTimeout(backgroundTimer);
  backgroundTimer = window.setTimeout(() => {
    const next = session.revisions.find((revision) => revision.render == null);
    if (next) void queueRevision(next);
  }, 400);
}

async function queueRevision(revision: Revision | undefined) {
  if (!revision || ["queued", "materializing", "compiling", "ready"].includes(revision.render?.phase ?? "")) {
    return;
  }
  await fetch(`${tokenBase}/api/render`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ revision_key: revision.key }),
  });
}

function pageUrl(status: RenderStatus | undefined, pageIndex: number): string | null {
  if (status?.phase !== "ready" || !status.render_id || !status.pages[pageIndex]) return null;
  return `${tokenBase}/assets/${status.render_id}/page/${status.pages[pageIndex].number}`;
}

function pageOrStatus(revision: Revision, url: string | null, label: string): string {
  if (url) return pageImage(url, `Revision ${label}`);
  const phase = revision.render?.phase;
  const message = revision.render?.message;
  return `
    <div class="render-status ${phase ?? "idle"}">
      <span class="status-letter">${label}</span>
      <strong>${phaseLabel(revision.render)}</strong>
      <p>${escapeHtml(message ?? (phase ? "Preparing this revision…" : "Select this revision to render it."))}</p>
    </div>
  `;
}

function pageImage(url: string, alt: string): string {
  return `<img class="document-page" src="${url}" alt="${alt}" draggable="false" />`;
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
  const revision = session.revisions.find((item) => item.key === key);
  if (!revision) throw new Error(`Unknown revision: ${key}`);
  return revision;
}

function revisionIndex(key: string): number {
  return session.revisions.findIndex((revision) => revision.key === key);
}

function valueAndProgress(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.style.setProperty("--progress", `${value}%`);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "2-digit" }).format(
    new Date(value),
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
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
