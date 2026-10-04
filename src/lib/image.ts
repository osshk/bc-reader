export type PreparedImage = {
  base64: string;
  mimeType: "image/jpeg";
  previewUrl: string;
  thumbDataUrl: string;
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
    };
  } finally {
    bitmap.close();
  }
}
