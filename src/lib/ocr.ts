export async function recognizeCard(image: Blob, onProgress: (message: string) => void): Promise<string> {
  onProgress("Loading the on-device reader…");
  const tesseract = await import("tesseract.js");
  const api = tesseract as typeof tesseract & {
    default?: { createWorker?: typeof tesseract.createWorker; PSM?: typeof tesseract.PSM };
  };
  const createWorker = tesseract.createWorker ?? api.default?.createWorker;
  const PSM = tesseract.PSM ?? api.default?.PSM;
  if (!createWorker || !PSM) {
    throw new Error("The on-device reader failed to start.");
  }

  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(`Reading the card… ${Math.round((message.progress ?? 0) * 100)}%`);
      } else {
        onProgress("Loading the on-device reader…");
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      user_defined_dpi: "300",
    });
    const first = await worker.recognize(image);
    let text = first.data.text ?? "";
    if (text.trim().length < 12) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const second = await worker.recognize(image);
      if ((second.data.text ?? "").trim().length > text.trim().length) {
        text = second.data.text ?? text;
      }
    }
    return text;
  } finally {
    await worker.terminate();
  }
}
