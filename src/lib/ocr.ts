import { parseQuality } from "@/lib/parse-text";

type SegmentMode = { SINGLE_BLOCK: string; SPARSE_TEXT: string };
type RecognizeWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (image: Blob) => Promise<{ data: { text?: string | null } }>;
  terminate: () => Promise<unknown>;
};

async function loadTesseract() {
  const tesseract = await import("tesseract.js");
  const api = tesseract as typeof tesseract & {
    default?: { createWorker?: typeof tesseract.createWorker; PSM?: typeof tesseract.PSM };
  };
  const createWorker = tesseract.createWorker ?? api.default?.createWorker;
  const PSM = tesseract.PSM ?? api.default?.PSM;
  if (!createWorker || !PSM) throw new Error("The on-device reader failed to start.");
  return { createWorker, PSM: PSM as SegmentMode };
}

async function readWithWorker(
  worker: RecognizeWorker,
  image: Blob,
  PSM: SegmentMode,
  onProgress: (message: string) => void,
): Promise<string> {
  let best = "";
  let bestScore = -1;
  for (const mode of [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT]) {
    onProgress(best ? "Checking another layout…" : "Reading the card…");
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
      user_defined_dpi: "300",
    });
    const result = await worker.recognize(image);
    const text = result.data.text ?? "";
    const score = parseQuality(text);
    if (score > bestScore) {
      best = text;
      bestScore = score;
    }
    if (bestScore >= 12) break;
  }
  return best;
}

async function recognizeLanguages(
  langs: string | string[],
  image: Blob,
  onProgress: (message: string) => void,
): Promise<string> {
  const { createWorker, PSM } = await loadTesseract();
  const worker = await createWorker(langs, 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(`Reading the card… ${Math.round((message.progress ?? 0) * 100)}%`);
      } else {
        onProgress("Loading the on-device reader…");
      }
    },
  });
  try {
    return await readWithWorker(worker, image, PSM, onProgress);
  } finally {
    await worker.terminate();
  }
}

export async function recognizeCard(image: Blob, onProgress: (message: string) => void): Promise<string> {
  onProgress("Loading the on-device reader…");
  let bilingual = "";
  try {
    bilingual = await recognizeLanguages(["eng", "chi_tra"], image, onProgress);
  } catch {
    bilingual = "";
  }
  if (parseQuality(bilingual) >= 12) return bilingual;
  try {
    const english = await recognizeLanguages("eng", image, onProgress);
    return parseQuality(english) > parseQuality(bilingual) ? english : bilingual;
  } catch (error) {
    if (bilingual.trim()) return bilingual;
    throw error instanceof Error ? error : new Error("The on-device reader failed to start.");
  }
}
