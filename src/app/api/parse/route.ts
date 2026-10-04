import { draftFromUnknown } from "@/lib/contact";
import { extractJson, GEMINI_PROMPT, GEMINI_SCHEMA, geminiModel } from "@/lib/gemini";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BASE64_CHARS = 4_500_000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"]);

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
  promptFeedback?: { blockReason?: string };
};

function failure(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  const serverKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const headerKey = request.headers.get("x-gemini-key")?.trim() ?? "";
  const apiKey = serverKey || headerKey;
  if (!apiKey) {
    return failure(503, "no_key", "No Gemini API key is configured.");
  }
  if (headerKey && !serverKey && (headerKey.length < 20 || headerKey.length > 200)) {
    return failure(400, "bad_key", "That Gemini key does not look valid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(400, "bad_body", "Send the card photo as JSON.");
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const imageBase64 = typeof record.imageBase64 === "string" ? record.imageBase64 : "";
  const mimeType = typeof record.mimeType === "string" ? record.mimeType : "";
  if (!ALLOWED_MIME.has(mimeType) || !/^[A-Za-z0-9+/=\s]+$/.test(imageBase64)) {
    return failure(400, "bad_image", "Use a JPEG, PNG, or WebP photo of the card.");
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return failure(413, "too_large", "That photo is too large. Move closer and try again.");
  }

  const model = geminiModel();
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: GEMINI_PROMPT },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return failure(504, "timeout", "Gemini did not answer in time. BC Reader can read the card on this device instead.");
    }
    return failure(502, "gemini_unreachable", "Gemini could not be reached. Try again in a moment.");
  }

  let payload: GeminiResponse;
  try {
    payload = (await response.json()) as GeminiResponse;
  } catch {
    return failure(502, "gemini_bad_response", "Gemini returned something BC Reader could not read.");
  }

  if (!response.ok) {
    const status = payload.error?.status ?? "";
    const detail = payload.error?.message ?? "";
    if (response.status === 401 || response.status === 403 || /api key/i.test(detail)) {
      return failure(401, "rejected_key", "Gemini refused the key. Check it in Settings or in your Netlify environment.");
    }
    if (response.status === 400 || status === "INVALID_ARGUMENT") {
      return failure(502, "gemini_error", "Gemini could not read this card.");
    }
    if (response.status === 404) {
      return failure(502, "unknown_model", `Gemini does not recognize the model “${model}”. Set GEMINI_MODEL to a current Flash model.`);
    }
    if (response.status === 429) {
      return failure(429, "rate_limited", "Gemini is rate-limiting reads. Wait a moment and try again.");
    }
    return failure(502, "gemini_error", "Gemini could not read this card.");
  }

  if (payload.promptFeedback?.blockReason) {
    return failure(422, "blocked", "Gemini declined to read this image.");
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) {
    return failure(422, "empty", "Gemini did not find a contact on this card.");
  }

  try {
    const draft = draftFromUnknown(extractJson(text));
    return NextResponse.json({ contact: draft, engine: "gemini", model });
  } catch {
    return failure(422, "unparsed", "Gemini read the card but the contact could not be structured.");
  }
}
