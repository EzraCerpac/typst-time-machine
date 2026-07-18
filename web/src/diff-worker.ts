/// <reference lib="webworker" />

import pixelmatch from "pixelmatch";

interface DiffRequest {
  left: ArrayBuffer;
  right: ArrayBuffer;
  width: number;
  height: number;
}

self.onmessage = (event: MessageEvent<DiffRequest>) => {
  const { left, right, width, height } = event.data;
  const output = new Uint8ClampedArray(width * height * 4);
  const changed = pixelmatch(
    new Uint8ClampedArray(left),
    new Uint8ClampedArray(right),
    output,
    width,
    height,
    {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.45,
      diffColor: [12, 117, 138],
      aaColor: [190, 139, 55],
    },
  );
  self.postMessage(
    {
      output: output.buffer,
      width,
      height,
      changed,
      total: width * height,
    },
    { transfer: [output.buffer] },
  );
};

