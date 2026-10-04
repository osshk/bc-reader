export type SampleId = "northwind" | "hale";

type Line = { text: string; size: number; font: "serif" | "sans"; gap: number; color: string; track?: number };

const INK = "#1c1915";
const MUTED = "#5c5348";
const BRASS = "#8c6239";
const PAPER = "#f7f3ea";

const SAMPLES: Record<SampleId, { lines: Line[] }> = {
  northwind: {
    lines: [
      { text: "NORTHWIND STUDIO", size: 28, font: "sans", gap: 36, color: BRASS, track: 4 },
      { text: "Maya Chen", size: 72, font: "serif", gap: 18, color: INK },
      { text: "Product Design Director", size: 32, font: "sans", gap: 48, color: MUTED },
      { text: "maya@northwind.studio", size: 30, font: "sans", gap: 16, color: INK },
      { text: "+1 415 555 0148", size: 30, font: "sans", gap: 16, color: INK },
      { text: "northwind.studio", size: 30, font: "sans", gap: 36, color: INK },
      { text: "548 Market Street", size: 28, font: "sans", gap: 12, color: MUTED },
      { text: "San Francisco, CA 94104", size: 28, font: "sans", gap: 0, color: MUTED },
    ],
  },
  hale: {
    lines: [
      { text: "HALE & BIRCH", size: 28, font: "sans", gap: 36, color: BRASS, track: 4 },
      { text: "Julian Okonkwo", size: 68, font: "serif", gap: 18, color: INK },
      { text: "Partner", size: 32, font: "sans", gap: 44, color: MUTED },
      { text: "M  +44 20 7946 0991", size: 30, font: "sans", gap: 14, color: INK },
      { text: "E  j.okonkwo@halebirch.com", size: 30, font: "sans", gap: 14, color: INK },
      { text: "W  halebirch.com", size: 30, font: "sans", gap: 14, color: INK },
      { text: "in linkedin.com/in/julianokonkwo", size: 26, font: "sans", gap: 36, color: INK },
      { text: "12 Greencoat Place", size: 28, font: "sans", gap: 12, color: MUTED },
      { text: "London SW1P 1PH", size: 28, font: "sans", gap: 12, color: MUTED },
      { text: "United Kingdom", size: 28, font: "sans", gap: 0, color: MUTED },
    ],
  },
};

function fontStack(kind: Line["font"]): string {
  if (kind === "serif") return "'Liberation Serif', 'DejaVu Serif', Georgia, serif";
  return "'Liberation Sans', 'DejaVu Sans', 'Helvetica Neue', sans-serif";
}

export function drawSample(id: SampleId): Promise<Blob> {
  const sample = SAMPLES[id];
  const canvas = document.createElement("canvas");
  canvas.width = 1500;
  canvas.height = id === "hale" ? 980 : 900;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Could not draw the sample card."));

  context.fillStyle = PAPER;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = BRASS;
  context.fillRect(0, 0, 18, canvas.height);

  let y = 120;
  for (const line of sample.lines) {
    context.fillStyle = line.color;
    context.font = `${line.font === "serif" ? "500 " : ""}${line.size}px ${fontStack(line.font)}`;
    context.letterSpacing = line.track ? `${line.track}px` : "0px";
    context.fillText(line.text, 90, y);
    y += line.size + line.gap;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the sample card."))),
      "image/jpeg",
      0.92,
    );
  });
}

export const SAMPLE_LABELS: Record<SampleId, string> = {
  northwind: "Northwind sample",
  hale: "Hale & Birch sample",
};
