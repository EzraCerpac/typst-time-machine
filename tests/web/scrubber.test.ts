import { describe, expect, test } from "bun:test";
import {
  LatestFrameScheduler,
  LeadingLatestThrottle,
  type FrameCallback,
} from "../../web/src/scrubber";

function controlledFrames() {
  let nextHandle = 1;
  const callbacks = new Map<number, FrameCallback>();
  return {
    callbacks,
    schedule(callback: FrameCallback) {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel(handle: number) {
      callbacks.delete(handle);
    },
    run(handle: number) {
      const callback = callbacks.get(handle);
      callbacks.delete(handle);
      callback?.(0);
    },
  };
}

describe("revision scrubber scheduling", () => {
  test("binds the browser animation frame receiver", () => {
    const originalWindow = globalThis.window;
    let frame: FrameCallback | undefined;
    const fakeWindow = {
      requestAnimationFrame(this: unknown, callback: FrameCallback) {
        expect(this).toBe(fakeWindow);
        frame = callback;
        return 1;
      },
      cancelAnimationFrame(this: unknown) {
        expect(this).toBe(fakeWindow);
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow,
    });
    try {
      const applied: number[] = [];
      const scheduler = new LatestFrameScheduler<number>((value) => applied.push(value));
      scheduler.schedule(7);
      frame?.(0);
      expect(applied).toEqual([7]);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  test("applies only the latest selection once per frame", () => {
    const frames = controlledFrames();
    const applied: number[] = [];
    const scheduler = new LatestFrameScheduler<number>(
      (value) => applied.push(value),
      frames.schedule,
      frames.cancel,
    );

    scheduler.schedule(2);
    scheduler.schedule(7);
    scheduler.schedule(11);
    expect(frames.callbacks.size).toBe(1);

    const handle = [...frames.callbacks.keys()][0];
    if (handle === undefined) throw new Error("expected one scheduled frame");
    frames.run(handle);
    expect(applied).toEqual([11]);
  });

  test("flushes the final release immediately and cancels the stale frame", () => {
    const frames = controlledFrames();
    const applied: number[] = [];
    const scheduler = new LatestFrameScheduler<number>(
      (value) => applied.push(value),
      frames.schedule,
      frames.cancel,
    );

    scheduler.schedule(4);
    scheduler.schedule(9);
    scheduler.flush();

    expect(applied).toEqual([9]);
    expect(frames.callbacks.size).toBe(0);
    scheduler.flush();
    expect(applied).toEqual([9]);
  });

  test("cancel drops a superseded drag selection", () => {
    const frames = controlledFrames();
    const applied: number[] = [];
    const scheduler = new LatestFrameScheduler<number>(
      (value) => applied.push(value),
      frames.schedule,
      frames.cancel,
    );

    scheduler.schedule(6);
    scheduler.cancel();

    expect(frames.callbacks.size).toBe(0);
    expect(applied).toEqual([]);
  });
});

describe("live focus throttling", () => {
  test("starts during a continuous drag and keeps the latest value", () => {
    let now = 0;
    let nextHandle = 1;
    const callbacks = new Map<number, () => void>();
    const applied: number[] = [];
    const throttle = new LeadingLatestThrottle<number>(
      50,
      (value) => applied.push(value),
      () => now,
      (callback) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      },
      (handle) => {
        callbacks.delete(handle);
      },
    );

    throttle.schedule(1);
    expect(applied).toEqual([1]);
    for (let value = 2; value <= 8; value += 1) {
      now += 10;
      throttle.schedule(value);
      if (now % 50 === 0) {
        const pending = [...callbacks.entries()][0];
        if (pending) {
          callbacks.delete(pending[0]);
          pending[1]();
        }
      }
    }
    expect(applied.length).toBeGreaterThan(1);
    throttle.flush();
    expect(applied.at(-1)).toBe(8);
  });
});
