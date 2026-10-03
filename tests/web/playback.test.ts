import { describe, expect, test } from "bun:test";
import { RevisionPlayback } from "../../web/src/playback";

function harness() {
  const selections: string[] = [];
  const messages: string[] = [];
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let next = 0;
  const playback = new RevisionPlayback(
    (key) => selections.push(key),
    (message) => messages.push(message),
    (callback, delay) => { timers.set(++next, { callback, delay }); return next; },
    (handle) => { timers.delete(handle); },
  );
  function tick() {
    const entry = [...timers.entries()][0];
    if (!entry) throw new Error("no timer");
    timers.delete(entry[0]);
    entry[1].callback();
  }
  return { playback, selections, messages, timers, tick };
}

describe("revision playback", () => {
  test("waits for presentation of each revision and finishes at newest", () => {
    const h = harness();
    h.playback.start(["old", "middle", "new"], "old");
    expect(h.selections).toEqual(["old"]);
    expect(h.timers.size).toBe(0);
    h.playback.ready("new"); // Prefetch events must not advance the selection.
    expect(h.timers.size).toBe(0);
    h.playback.ready("old");
    h.tick();
    expect(h.selections).toEqual(["old", "middle"]);
    expect(h.timers.size).toBe(0);
    h.playback.ready("middle");
    h.tick();
    h.playback.ready("new");
    expect(h.playback.playing).toBe(false);
    expect(h.timers.size).toBe(0);
    expect(h.messages.at(-1)).toBe("Playback complete");
  });

  test("replays from oldest at the end and resumes from an interior selection", () => {
    const h = harness();
    h.playback.start(["old", "middle", "new"], "new");
    expect(h.selections).toEqual(["old"]);
    h.playback.start(["old", "middle", "new"], "middle");
    expect(h.selections.at(-1)).toBe("middle");
  });

  test("pause cancels both waiting and holding; late callbacks cannot restart", () => {
    const h = harness();
    h.playback.start(["old", "new"], "old");
    h.playback.stop("Paused");
    h.playback.ready("old");
    expect(h.timers.size).toBe(0);
    h.playback.start(["old", "new"], "old");
    h.playback.ready("old");
    const stale = [...h.timers.values()][0].callback;
    h.playback.stop();
    stale();
    expect(h.selections).toEqual(["old", "old"]);
    expect(h.timers.size).toBe(0);
  });

  test("restart invalidates an old timer even while playing again", () => {
    const h = harness();
    h.playback.start(["a", "b"], "a");
    h.playback.ready("a");
    const stale = [...h.timers.values()][0].callback;
    h.playback.start(["c", "d"], "c");
    stale();
    h.playback.ready("a");
    expect(h.selections).toEqual(["a", "c"]);
    expect(h.timers.size).toBe(0);
  });

  test("duplicate ready events do not extend a frame's hold", () => {
    const h = harness();
    h.playback.start(["a", "b"], "a");
    h.playback.ready("a");
    const first = [...h.timers.keys()];
    h.playback.ready("a");
    expect([...h.timers.keys()]).toEqual(first);
  });

  test("speed changes replace a hold timer but never bypass a render", () => {
    const h = harness();
    h.playback.start(["a", "b"], "a");
    h.playback.setSpeed(4);
    expect(h.timers.size).toBe(0);
    h.playback.ready("a");
    expect([...h.timers.values()][0].delay).toBe(250);
    const stale = [...h.timers.values()][0].callback;
    h.playback.setSpeed(0.5);
    expect(h.timers.size).toBe(1);
    expect([...h.timers.values()][0].delay).toBe(2000);
    stale();
    expect(h.selections).toEqual(["a"]);
    h.playback.setSpeed(NaN);
    expect([...h.timers.values()][0].delay).toBe(2000);
  });

  test("only selected revision failures stop playback", () => {
    const h = harness();
    h.playback.start(["a", "b"], "a");
    h.playback.failed("b", "error");
    expect(h.playback.playing).toBe(true);
    h.playback.failed("a", "error");
    expect(h.playback.playing).toBe(false);
    h.playback.ready("a");
    expect(h.timers.size).toBe(0);
    expect(h.messages.at(-1)).toBe("error");
  });

  test("uses a stable sequence even if the caller changes its history list", () => {
    const h = harness();
    const keys = ["a", "b"];
    h.playback.start(keys, "a");
    keys[1] = "other";
    h.playback.ready("a");
    h.tick();
    expect(h.selections).toEqual(["a", "b"]);
  });

  test("empty and single revision histories cannot play", () => {
    const h = harness();
    h.playback.start([], "");
    h.playback.start(["a"], "a");
    expect(h.playback.playing).toBe(false);
    expect(h.selections).toEqual([]);
  });
});
