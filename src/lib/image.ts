export type PreparedImage = {
  base64: string;
  mimeType: "image/jpeg";
  previewUrl: string;
  thumbDataUrl: string;
  ocrBlob?: Blob;
};

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

function renderJpeg(source: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare that photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("This browser could not prepare that photo."))),
      "image/jpeg",
      quality,
    );
  });
}

function ocrSize(width: number, height: number): { width: number; height: number } {
  const scale = width < 2000 ? 2000 / width : width > 2400 ? 2000 / width : 1;
  let nextWidth = Math.max(1, Math.round(width * scale));
  let nextHeight = Math.max(1, Math.round(height * scale));
  if (nextHeight > 4000) {
    const down = 4000 / nextHeight;
    nextWidth = Math.max(1, Math.round(nextWidth * down));
    nextHeight = 4000;
  }
  return { width: nextWidth, height: nextHeight };
}

function punchContrast(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  let min = 255;
  let max = 0;
  const gray = new Uint8ClampedArray(pixels.length / 4);
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const value = Math.round(pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114);
    gray[pixel] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = Math.max(1, max - min);
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const stretched = ((gray[pixel] - min) * 255) / span;
    const contrasted = stretched * 1.4 - 30;
    const ink = contrasted >= 150 ? 255 : 0;
    pixels[index] = ink;
    pixels[index + 1] = ink;
    pixels[index + 2] = ink;
    pixels[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function renderOcrPng(source: ImageBitmap): Promise<Blob> {
  const size = ocrSize(source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not prepare that photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, size.width, size.height);
  punchContrast(context, size.width, size.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("This browser could not prepare that photo."))),
      "image/png",
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new Error("That photo format could not be opened. Use a JPEG or PNG.");
  }

  try {
    const main = await renderJpeg(bitmap, 1280, 0.8);
    const thumb = await renderJpeg(bitmap, 480, 0.72);
    let ocrBlob: Blob | undefined;
    try {
      ocrBlob = await renderOcrPng(bitmap);
    } catch {
      ocrBlob = undefined;
    }
    const dataUrl = await blobToDataUrl(main);
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    if (base64.length > 4_000_000) {
      throw new Error("That photo is still too large. Move closer to the card and try again.");
    }
    return {
      base64,
      mimeType: "image/jpeg",
      previewUrl: URL.createObjectURL(main),
      thumbDataUrl: await blobToDataUrl(thumb),
      ocrBlob,
    };
  } finally {
    bitmap.close();
  }
}
