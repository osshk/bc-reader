import { displayName, type ContactDraft, type ReadEngine, type Settings } from "@/lib/contact";
import { type PreparedImage } from "@/lib/image";
import { parseCardText } from "@/lib/parse-text";

async function readWithGemini(prepared: PreparedImage, settings: Settings, serverGemini: boolean) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!serverGemini && settings.geminiKey.trim()) headers["x-gemini-key"] = settings.geminiKey.trim();
  const response = await fetch("/api/parse", {
    method: "POST",
    headers,
    body: JSON.stringify({ imageBase64: prepared.base64, mimeType: prepared.mimeType }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    contact?: ContactDraft;
  };
  if (!response.ok) {
    const error = new Error(payload.message || "The card could not be read.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (!payload.contact) throw new Error("Gemini returned an empty contact.");
  return payload.contact;
}

export type CardRead = { draft: ContactDraft; engine: ReadEngine; banner: string | null };

export async function readCard(
  prepared: PreparedImage, settings: Settings, serverGemini: boolean,
  onProgress: (message: string) => void,
): Promise<CardRead> {
  if (!prepared.base64) throw new Error("This saved card has no photo to read again. Edit the fields instead.");
  const hasGemini = serverGemini || Boolean(settings.geminiKey.trim());
  if (settings.engine === "gemini" && !hasGemini) {
    throw new Error("Add a Gemini API key in Settings, or switch the reader to this device.");
  }
  let banner: string | null = null;
  if (settings.engine !== "device" && hasGemini) {
    onProgress("Sending the photo to Gemini…");
    try {
      return { draft: await readWithGemini(prepared, settings, serverGemini), engine: "gemini", banner };
    } catch (error) {
      const status = error instanceof Error && "status" in error ? Number(error.status) : 0;
      if (settings.engine !== "auto" || !(status === 0 || status === 429 || status >= 500)) throw error;
      banner = "Gemini was unavailable, so this card was read on your device. Check the fields.";
    }
  }
  onProgress("Reading the type on this device…");
  const blob = prepared.ocrBlob ? prepared.ocrBlob : await fetch(prepared.previewUrl).then((response) => response.blob());
  const { recognizeCard } = await import("@/lib/ocr");
  const draft = parseCardText(await recognizeCard(blob, onProgress));
  const empty = !displayName(draft) && !draft.phones.length && !draft.emails.length;
  return { draft, engine: "device", banner: empty ? "Nothing readable came back. Type the contact, or try a sharper photo." : banner };
}
