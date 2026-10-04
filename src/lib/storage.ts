import {
  defaultSettings,
  emptyDraft,
  type ContactDraft,
  type EngineChoice,
  type ReadEngine,
  type SavedContact,
  type Settings,
} from "@/lib/contact";

const BOOK_KEY = "brass.book.v1";
const SETTINGS_KEY = "brass.settings.v1";

function isEngine(value: unknown): value is ReadEngine {
  return value === "gemini" || value === "device";
}

function isChoice(value: unknown): value is EngineChoice {
  return value === "auto" || value === "gemini" || value === "device";
}

function asDraft(value: unknown): ContactDraft {
  const record = value && typeof value === "object" ? (value as Partial<ContactDraft>) : {};
  const base = emptyDraft();
  return {
    ...base,
    ...record,
    phones: Array.isArray(record.phones) ? record.phones : [],
    emails: Array.isArray(record.emails) ? record.emails : [],
  };
}

export function loadBook(): SavedContact[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOOK_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Partial<SavedContact>;
      if (typeof record.id !== "string") return [];
      return [
        {
          ...asDraft(record),
          id: record.id,
          createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
          engine: isEngine(record.engine) ? record.engine : "device",
          thumbDataUrl: typeof record.thumbDataUrl === "string" ? record.thumbDataUrl : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

export function saveBook(book: SavedContact[]) {
  const payload = JSON.stringify(book);
  try {
    window.localStorage.setItem(BOOK_KEY, payload);
  } catch {
    const slim = book.map((contact) => ({ ...contact, thumbDataUrl: "" }));
    window.localStorage.setItem(BOOK_KEY, JSON.stringify(slim));
  }
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    return {
      engine: isChoice(parsed.engine) ? parsed.engine : "auto",
      geminiKey: typeof parsed.geminiKey === "string" ? parsed.geminiKey : "",
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
