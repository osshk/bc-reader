// Keep only one full-size photo and OCR job in memory at a time.
// Failures belong to individual cards and must not stop the rest of a batch.
export async function runBatch<T, R>(
  items: T[],
  read: (item: T, index: number) => Promise<R>,
  settle: (index: number, result: { value: R } | { error: string }) => void,
  stopped: () => boolean,
) {
  for (let index = 0; index < items.length; index++) {
    if (stopped()) break;
    try {
      const value = await read(items[index], index);
      settle(index, { value });
    } catch (error) {
      settle(index, { error: error instanceof Error ? error.message : "This card could not be read." });
    }
  }
}
