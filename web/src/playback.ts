import type { CancelDelay, ScheduleDelay } from "./scrubber";

// Render events drive playback; a timer only controls how long a ready frame stays.
export class RevisionPlayback {
  private keys: string[] = [];
  private position = 0;
  private timer: number | undefined;
  private generation = 0;
  private presented = false;
  private delay = 1000;
  playing = false;

  constructor(
    private readonly select: (key: string) => void,
    private readonly changed: (message: string) => void,
    private readonly schedule: ScheduleDelay = window.setTimeout.bind(window),
    private readonly cancel: CancelDelay = window.clearTimeout.bind(window),
  ) {}

  start(keys: string[], selected: string) {
    this.stop();
    if (keys.length < 2) return;
    this.keys = [...keys];
    const current = keys.indexOf(selected);
    this.position = current >= 0 && current < keys.length - 1 ? current : 0;
    this.playing = true;
    this.selectCurrent();
  }

  stop(message = "") {
    this.generation += 1;
    if (this.timer !== undefined) this.cancel(this.timer);
    this.timer = undefined;
    this.presented = false;
    this.playing = false;
    this.changed(message);
  }

  setSpeed(speed: number) {
    if (![0.5, 1, 2, 4].includes(speed)) return;
    this.delay = 1000 / speed;
    if (this.playing && this.presented) this.hold();
  }

  // Calling this twice for the same revision must not restart its hold timer.
  ready(key: string) {
    if (!this.playing || key !== this.keys[this.position] || this.presented) return;
    this.presented = true;
    if (this.position === this.keys.length - 1) {
      this.stop("Playback complete");
    } else {
      this.changed("Playing");
      this.hold();
    }
  }

  failed(key: string, message: string) {
    if (this.playing && key === this.keys[this.position]) this.stop(message);
  }

  private selectCurrent() {
    this.presented = false;
    this.changed("Waiting for render…");
    this.select(this.keys[this.position]);
  }

  private hold() {
    if (this.timer !== undefined) this.cancel(this.timer);
    const generation = ++this.generation;
    this.timer = this.schedule(() => {
      if (!this.playing || generation !== this.generation) return;
      this.timer = undefined;
      this.position += 1;
      this.selectCurrent();
    }, this.delay);
  }
}
