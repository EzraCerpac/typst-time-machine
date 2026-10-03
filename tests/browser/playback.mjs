// Optional headless integration check. Use an installed Playwright via
// PLAYWRIGHT_MODULE and, if needed, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
// Run through Portless: portless ttm-playback-check node tests/browser/playback.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = process.env.PLAYBACK_SCREENSHOT_DIR ?? join(root, "target/playback-screenshots");
await mkdir(output, { recursive: true });
const keys = ["new", "middle", "old"];
let statuses = new Map();
let heldImage = null;
let imageWaiters = [];
const clients = new Set();
let focusFailure = false;
const status = (key, phase = "ready") => ({
  revision_key: key, phase, render_id: key,
  pages: phase === "ready" ? [1, 2].map(number => ({ number, file: `${number}.svg`, hash: `${key}-${number}` })) : [],
  placeholder_files: [],
});
const session = () => ({
  repository: { kind: "git", root: "/fixtures/document-history", identity: "test" },
  target: { entry: "main.typ", root: ".", history_paths: [], font_paths: [], inputs: {}, missing_figure_roots: [] },
  compiler: "Isolated render fixture",
  history: { limit: 3, max_limit: 100, first_parent_keys: keys, full_tree_keys: keys },
  revisions: keys.map((key, i) => ({
    key, commit_id: key, parent_ids: keys[i + 1] ? [keys[i + 1]] : [],
    subject: ["Polish the final layout", "Add the main result", "Start the document"][i],
    author: "TTM Test", author_email: "test@example.invalid", authored_at: `2026-09-0${3 - i}T12:00:00Z`,
    committed_at: `2026-09-0${3 - i}T12:00:00Z`, committer_unix: i,
    bookmarks: [], changed_paths: ["main.typ"], render: statuses.get(key),
  })),
});
function sendStatus(key, phase = "ready") {
  statuses.set(key, status(key, phase));
  for (const client of clients) client.write(`event: render\ndata: ${JSON.stringify({ status: statuses.get(key) })}\n\n`);
}
function releaseImages() {
  heldImage = null;
  imageWaiters.splice(0).forEach(resolve => resolve());
}
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/test/api/session" || path === "/test/api/history") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(session()));
  } else if (path === "/test/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write(": connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
  } else if (path === "/test/api/focus") {
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.ok(JSON.parse(body).generation > 0);
    res.writeHead(focusFailure ? 503 : 200);
    res.end("{}");
  } else if (path.includes("/assets/")) {
    res.setHeader("cache-control", "no-store");
    const key = path.split("/")[3];
    if (key === heldImage) await new Promise(resolve => imageWaiters.push(resolve));
    if (key === "broken") { res.writeHead(500); res.end(); return; }
    res.setHeader("content-type", "image/svg+xml");
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600"><rect width="480" height="600" fill="#fffdf5"/><text x="45" y="70" font-size="24">Document revision: ${key}</text><path d="M45 110h380M45 135h330M45 160h360" stroke="#526668" stroke-width="3"/></svg>`);
  } else {
    const file = path.endsWith("styles.css") ? "web/styles.css" : path.endsWith("diff-worker.js") ? "web/dist/diff-worker.js" : path.endsWith("app.js") ? "web/dist/app.js" : "web/index.html";
    res.setHeader("content-type", file.endsWith("css") ? "text/css" : file.endsWith("js") ? "text/javascript" : "text/html");
    res.end(await readFile(join(root, file)));
  }
});
await new Promise(resolve => server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", resolve));
const url = `${process.env.PORTLESS_URL ?? `http://127.0.0.1:${server.address().port}`}/test/`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, ignoreHTTPSErrors: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const released = new WeakSet();
    window.holdHeatmap = false;
    window.pendingHeatmaps = [];
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.workerForTest = this;
        this.addEventListener("message", event => {
          if (!window.holdHeatmap || released.has(event)) return;
          event.stopImmediatePropagation();
          window.pendingHeatmaps.push(() => {
            const next = new MessageEvent("message", { data: event.data });
            released.add(next);
            this.dispatchEvent(next);
          });
        });
      }
    };
  });
  const toggle = page.locator("#playback-toggle");
  const selected = () => page.locator("#revision-slider").inputValue();
  const waitSelected = value => page.waitForFunction(v => document.querySelector("#revision-slider").value === v, value);
  const waitPaused = () => page.waitForFunction(() => document.querySelector("#playback-toggle").textContent === "Play");
  const waitImage = key => page.waitForFunction(k => document.querySelector('[data-page-slot="b"] img')?.src.includes(`/assets/${k}/`), key);
  async function load(phases = {}) {
    releaseImages();
    statuses = new Map(keys.map(key => [key, status(key, phases[key] ?? "ready")]));
    focusFailure = false;
    await page.goto(url);
    await toggle.waitFor();
    await page.locator("#playback-speed").selectOption("4");
  }
  async function scrub(value) {
    await page.locator("#revision-slider").evaluate((slider, next) => {
      slider.value = next;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  }
  const waitHeatmap = () => page.waitForFunction(() => document.querySelector("#stage").dataset.heatmapState === "ready");
  const waitHeldHeatmap = () => page.waitForFunction(() => window.pendingHeatmaps.length > 0);
  async function releaseHeatmaps() {
    await page.evaluate(() => {
      window.holdHeatmap = false;
      window.pendingHeatmaps.splice(0).forEach(release => release());
    });
  }

  // Slow render AND slow image: neither may allow a second advancement.
  await load({ middle: "compiling" });
  await toggle.click(); // Newest selection replays from oldest.
  await waitSelected("1");
  await page.waitForTimeout(350);
  assert.equal(await selected(), "1");
  heldImage = "middle";
  sendStatus("middle");
  await page.waitForTimeout(350);
  assert.equal(await selected(), "1");
  assert.ok(imageWaiters.length > 0, "selected page image must actually be pending");
  await page.screenshot({ path: join(output, "waiting-desktop.png"), fullPage: true });
  releaseImages();
  await waitPaused();
  assert.equal(await selected(), "2");
  assert.match(await page.locator("#playback-status").textContent(), /complete/);
  await page.screenshot({ path: join(output, "complete-desktop.png"), fullPage: true });

  // Manual scrub while a previous image is loading: late ready/image responses
  // must not replace the chosen document or resume playback.
  await load({ middle: "compiling" });
  await toggle.click();
  await waitSelected("1");
  heldImage = "middle";
  sendStatus("middle");
  await page.waitForTimeout(100);
  await scrub("0");
  await waitPaused();
  releaseImages();
  await waitImage("old");
  await page.waitForTimeout(350);
  assert.equal(await selected(), "0");
  assert.match(await page.locator('[data-page-slot="b"] img').getAttribute("src"), /assets\/old\//);

  // Page navigation during preload must preserve the newly chosen page.
  await load({ middle: "compiling" });
  await toggle.click();
  await waitSelected("1");
  heldImage = "middle";
  sendStatus("middle");
  await page.waitForTimeout(100);
  await page.locator("#page-b").selectOption({ value: "1" });
  assert.equal(await toggle.textContent(), "Play");
  assert.ok(imageWaiters.length > 0);
  releaseImages();
  await waitImage("middle");
  await page.waitForTimeout(350);
  assert.equal(await page.locator("#page-b").inputValue(), "1");
  assert.match(await page.locator('[data-page-slot="b"] img').getAttribute("src"), /page\/2$/);
  assert.equal(await toggle.textContent(), "Play");

  // Pinning during preload settles the new A/B pair instead of leaving it busy.
  await load({ middle: "compiling" });
  await toggle.click();
  await waitSelected("1");
  heldImage = "middle";
  sendStatus("middle");
  await page.waitForTimeout(100);
  await page.locator("#pin-a").click();
  assert.equal(await toggle.textContent(), "Play");
  assert.equal(await page.locator("#stage").getAttribute("aria-busy"), "false");
  releaseImages();
  await waitImage("middle");
  await page.waitForTimeout(350);
  assert.equal(await selected(), "1");
  assert.equal(await page.locator("#stage").getAttribute("aria-busy"), "false");

  // Pause while waiting for a compiler, then resume at exactly that revision.
  await load({ middle: "compiling" });
  await toggle.click();
  await waitSelected("1");
  await toggle.click();
  sendStatus("middle");
  await waitImage("middle");
  await page.waitForTimeout(350);
  assert.equal(await selected(), "1");
  await toggle.click();
  await waitPaused();
  assert.equal(await selected(), "2");

  for (const phase of ["error", "entrypoint_missing"]) {
    await load({ middle: "compiling" });
    await toggle.click();
    await waitSelected("1");
    sendStatus("middle", phase);
    await waitPaused();
    await page.waitForTimeout(300);
    assert.equal(await selected(), "1");
    assert.match(await page.locator("#playback-status").textContent(), /stopped/);
  }

  // Page-image failure is also terminal.
  await load({ middle: "compiling" });
  await toggle.click();
  await waitSelected("1");
  const broken = status("middle");
  broken.render_id = "broken";
  statuses.set("middle", broken);
  for (const client of clients) client.write(`event: render\ndata: ${JSON.stringify({ status: broken })}\n\n`);
  await waitPaused();
  assert.match(await page.locator("#playback-status").textContent(), /image could not load/);
  assert.equal(await page.locator("#stage").getAttribute("aria-busy"), "false");
  assert.match(await page.locator("#stage").textContent(), /Could not load page image/);
  assert.equal(await page.locator('[data-page-slot="b"] img').isVisible(), false);
  await scrub("1"); // Manual selection must show the same error, not an old page.
  await page.waitForFunction(() => document.querySelector("#stage").getAttribute("aria-busy") === "false");
  assert.match(await page.locator("#stage").textContent(), /Could not load page image/);

  // Navigation/settings interrupt a ready frame's hold timer.
  for (const action of [
    () => page.locator('[data-history-mode="full-tree"]').click(),
    () => page.locator("#collapse").check(),
    () => page.locator("#page-b").selectOption({ value: "1" }),
    () => page.locator("#page-rail button").last().click(),
    () => page.locator("#pin-a").click(),
    () => page.keyboard.press("ArrowLeft"),
    async () => { await page.locator("#history-limit").fill("4"); await page.locator("#history-limit-form button").click(); },
    () => page.evaluate(() => window.dispatchEvent(new Event("pagehide"))),
    () => page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); }),
  ]) {
    await load();
    await toggle.click();
    await waitImage("old");
    await action();
    await waitPaused();
    const after = await selected();
    await page.waitForTimeout(350);
    assert.equal(await selected(), after);
  }

  await load({ old: "compiling" });
  focusFailure = true;
  await toggle.click();
  await waitPaused();
  assert.match(await page.locator("#playback-status").textContent(), /could not request render/);

  // Losing the SSE stream interrupts a waiting frame.
  await load({ old: "compiling" });
  await toggle.click();
  for (const client of clients) client.end();
  await waitPaused();
  assert.equal(await toggle.isDisabled(), true);

  // Heat mode must hold each revision until the worker's bitmap is displayed.
  await load();
  await page.locator('[data-mode="heatmap"]').click();
  await waitHeatmap();
  await page.evaluate(() => { window.holdHeatmap = true; });
  await toggle.click();
  await waitHeldHeatmap();
  await page.waitForTimeout(350);
  assert.equal(await selected(), "0");
  assert.equal(await toggle.textContent(), "Pause");
  await page.evaluate(() => window.pendingHeatmaps.splice(0).forEach(release => release()));
  await waitSelected("1");
  await waitHeldHeatmap();
  await toggle.click(); // Pausing during heatmap calculation must stay paused.
  await releaseHeatmaps();
  await waitHeatmap();
  await page.waitForTimeout(350);
  assert.equal(await selected(), "1");
  await toggle.click(); // Resume from the already displayed, cached heatmap.
  await waitPaused();
  assert.equal(await selected(), "2");
  await waitHeatmap();
  await page.screenshot({ path: join(output, "heatmap-desktop.png"), fullPage: true });

  // A stale worker response cannot ready a later manual selection.
  await load();
  await page.locator('[data-mode="heatmap"]').click();
  await waitHeatmap();
  await page.evaluate(() => { window.holdHeatmap = true; });
  await toggle.click();
  await waitHeldHeatmap();
  await scrub("1");
  await page.waitForFunction(() => window.pendingHeatmaps.length >= 2);
  await page.evaluate(() => window.pendingHeatmaps.shift()());
  assert.equal(await page.locator("#stage").getAttribute("data-heatmap-state"), "pending");
  await releaseHeatmaps();
  await waitHeatmap();
  await page.waitForTimeout(350);
  assert.equal(await selected(), "1");
  assert.equal(await toggle.textContent(), "Play");

  // Worker failures and unavailable pinned renders stop heatmap playback.
  await load();
  await page.locator('[data-mode="heatmap"]').click();
  await waitHeatmap();
  await page.evaluate(() => { window.holdHeatmap = true; });
  await toggle.click();
  await waitHeldHeatmap();
  await page.evaluate(() => window.workerForTest.dispatchEvent(new ErrorEvent("error", { message: "fixture failure" })));
  await waitPaused();
  assert.match(await page.locator("#playback-status").textContent(), /heatmap worker failed/);
  await releaseHeatmaps();
  for (const phase of ["error", "entrypoint_missing"]) {
    await load({ middle: phase }); // Initial pinned A is middle.
    await page.locator('[data-mode="heatmap"]').click();
    await toggle.click();
    await waitPaused();
    assert.match(await page.locator("#playback-status").textContent(), /needs both rendered pages/);
  }

  // A bitmap-load failure stops playback, and a corrected asset can be retried.
  await load();
  const brokenPinned = status("middle");
  brokenPinned.render_id = "broken";
  statuses.set("middle", brokenPinned);
  for (const client of clients) client.write(`event: render\ndata: ${JSON.stringify({ status: brokenPinned })}\n\n`);
  await page.locator('[data-mode="heatmap"]').click();
  await toggle.click();
  await waitPaused();
  assert.match(await page.locator("#playback-status").textContent(), /could not calculate heatmap/);
  sendStatus("middle");
  await waitHeatmap();
  await toggle.click();
  await waitPaused();
  assert.equal(await selected(), "2");

  await load();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, "mobile.png"), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile UI must not overflow horizontally");
  assert.deepEqual(errors, []);
  console.log(`Playback browser checks passed. Screenshots: ${output}`);
} finally {
  releaseImages();
  await browser?.close();
  for (const client of clients) client.end();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
