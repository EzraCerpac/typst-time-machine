/// <reference lib="webworker" />

import pixelmatch from "pixelmatch";

interface DiffRequest {
  left: ImageBitmap;
  right: ImageBitmap;
  scale: number;
  generation: number;
}

self.onmessage = (event: MessageEvent<DiffRequest>) => {
  const { left, right, scale, generation } = event.data;
  const width = Math.ceil(Math.max(left.width, right.width) * scale);
  const height = Math.ceil(Math.max(left.height, right.height) * scale);
  const rasterize = (image: ImageBitmap) => {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      Math.round((width - image.width * scale) / 2),
      Math.round((height - image.height * scale) / 2),
      image.width * scale,
      image.height * scale,
    );
    return context.getImageData(0, 0, width, height).data;
  };
  const leftPixels = rasterize(left);
  const rightPixels = rasterize(right);
  left.close();
  right.close();
  const output = new Uint8ClampedArray(width * height * 4);
  const changed = pixelmatch(
    leftPixels,
    rightPixels,
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
  const outputCanvas = new OffscreenCanvas(width, height);
  outputCanvas
    .getContext("2d")!
    .putImageData(new ImageData(output, width, height), 0, 0);
  const bitmap = outputCanvas.transferToImageBitmap();
  self.postMessage(
    {
      bitmap,
      width,
      height,
      changed,
      total: width * height,
      generation,
    },
    { transfer: [bitmap] },
  );
};
