export type FrameCallback = (time: number) => void;
export type ScheduleFrame = (callback: FrameCallback) => number;
export type CancelFrame = (handle: number) => void;
export type ScheduleDelay = (callback: () => void, delay: number) => number;
export type CancelDelay = (handle: number) => void;

export class LatestFrameScheduler<T> {
  private handle: number | undefined;
  private latest: T | undefined;
  private pending = false;

  constructor(
    private readonly apply: (value: T) => void,
    private readonly scheduleFrame: ScheduleFrame = window.requestAnimationFrame.bind(window),
    private readonly cancelFrame: CancelFrame = window.cancelAnimationFrame.bind(window),
  ) {}

  schedule(value: T) {
    this.latest = value;
    this.pending = true;
    if (this.handle !== undefined) return;
    this.handle = this.scheduleFrame(() => {
      this.handle = undefined;
      this.applyPending();
    });
  }

  flush() {
    if (this.handle !== undefined) {
      this.cancelFrame(this.handle);
      this.handle = undefined;
    }
    this.applyPending();
  }

  cancel() {
    if (this.handle !== undefined) {
      this.cancelFrame(this.handle);
      this.handle = undefined;
    }
    this.latest = undefined;
    this.pending = false;
  }

  private applyPending() {
    if (!this.pending) return;
    const value = this.latest as T;
    this.latest = undefined;
    this.pending = false;
    this.apply(value);
  }
}

export class LeadingLatestThrottle<T> {
  private timer: number | undefined;
  private latest: T | undefined;
  private lastApplied = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly interval: number,
    private readonly apply: (value: T) => void,
    private readonly now: () => number = performance.now.bind(performance),
    private readonly scheduleDelay: ScheduleDelay = window.setTimeout.bind(window),
    private readonly cancelDelay: CancelDelay = window.clearTimeout.bind(window),
  ) {}

  schedule(value: T) {
    this.latest = value;
    const remaining = this.interval - (this.now() - this.lastApplied);
    if (remaining <= 0 && this.timer === undefined) {
      this.applyLatest();
      return;
    }
    if (this.timer !== undefined) return;
    this.timer = this.scheduleDelay(() => {
      this.timer = undefined;
      this.applyLatest();
    }, Math.max(0, remaining));
  }

  flush() {
    if (this.timer !== undefined) {
      this.cancelDelay(this.timer);
      this.timer = undefined;
    }
    if (this.latest !== undefined) this.applyLatest();
  }

  private applyLatest() {
    if (this.latest === undefined) return;
    const value = this.latest;
    this.latest = undefined;
    this.lastApplied = this.now();
    this.apply(value);
  }
}
