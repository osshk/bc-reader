export const PHONE_LABELS = ["mobile", "work", "home", "fax", "other"] as const;
export type PhoneLabel = (typeof PHONE_LABELS)[number];

export const EMAIL_LABELS = ["work", "personal", "other"] as const;
export type EmailLabel = (typeof EMAIL_LABELS)[number];

export type Confidence = "high" | "medium" | "low";
export type ReadEngine = "gemini" | "device";
export type EngineChoice = "auto" | "gemini" | "device";

export type Phone = {
  label: PhoneLabel;
  number: string;
};

export type Email = {
  label: EmailLabel;
  address: string;
};

export type ContactDraft = {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  phones: Phone[];
  emails: Email[];
  website: string;
  linkedin: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
  confidence: Confidence;
  rawText: string;
};

export type SavedContact = ContactDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
  engine: ReadEngine;
  thumbDataUrl: string;
};

export type Settings = {
  engine: EngineChoice;
  geminiKey: string;
};

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function emptyDraft(): ContactDraft {
  return {
    fullName: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    company: "",
    phones: [],
    emails: [],
    website: "",
    linkedin: "",
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    notes: "",
    confidence: "low",
    rawText: "",
  };
}

export function defaultSettings(): Settings {
  return { engine: "auto", geminiKey: "" };
}

export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const clean = full.trim().replace(/\s+/g, " ");
  if (!clean) return { firstName: "", lastName: "" };
  if (clean.includes(",")) {
    const [last, rest] = clean.split(",", 2).map((part) => part.trim());
    return { firstName: rest ?? "", lastName: last ?? "" };
  }
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  const lastName = parts.pop() ?? "";
  return { firstName: parts.join(" "), lastName };
}

export function displayName(contact: Pick<ContactDraft, "fullName" | "firstName" | "lastName">): string {
  const full = contact.fullName.trim();
  if (full) return full;
  return [contact.firstName, contact.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim().replace(/[),.;]+$/g, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function asPhoneLabel(value: unknown): PhoneLabel {
  return PHONE_LABELS.includes(value as PhoneLabel) ? (value as PhoneLabel) : "work";
}

function asEmailLabel(value: unknown): EmailLabel {
  return EMAIL_LABELS.includes(value as EmailLabel) ? (value as EmailLabel) : "work";
}

function asConfidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDraft(input: ContactDraft): ContactDraft {
  const phones = input.phones
    .map((phone) => ({
      label: asPhoneLabel(phone.label),
      number: phone.number.replace(/\s+/g, " ").trim(),
    }))
    .filter((phone) => phone.number.replace(/\D/g, "").length >= 7);

  const emails = input.emails
    .map((email) => ({
      label: asEmailLabel(email.label),
      address: email.address.trim().toLowerCase(),
    }))
    .filter((email) => EMAIL_RE.test(email.address));

  let fullName = input.fullName.trim().replace(/\s+/g, " ");
  let firstName = input.firstName.trim().replace(/\s+/g, " ");
  let lastName = input.lastName.trim().replace(/\s+/g, " ");

  if (!fullName && (firstName || lastName)) {
    fullName = [firstName, lastName].filter(Boolean).join(" ");
  }
  if (fullName && !firstName && !lastName) {
    const parts = splitPersonName(fullName);
    firstName = parts.firstName;
    lastName = parts.lastName;
  }

  return {
    fullName,
    firstName,
    lastName,
    jobTitle: input.jobTitle.trim(),
    company: input.company.trim(),
    phones,
    emails,
    website: input.website.trim() ? normalizeUrl(input.website) : "",
    linkedin: input.linkedin.trim() ? normalizeUrl(input.linkedin) : "",
    street: input.street.trim(),
    city: input.city.trim(),
    region: input.region.trim(),
    postalCode: input.postalCode.trim(),
    country: input.country.trim(),
    notes: input.notes.trim(),
    confidence: asConfidence(input.confidence),
    rawText: input.rawText.trim(),
  };
}

export function draftFromUnknown(value: unknown, rawText = ""): ContactDraft {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const phones = Array.isArray(record.phones)
    ? record.phones.map((item) => {
        const phone = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return { label: asPhoneLabel(phone.label), number: text(phone.number) };
      })
    : [];
  const emails = Array.isArray(record.emails)
    ? record.emails.map((item) => {
        const email = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return { label: asEmailLabel(email.label), address: text(email.address) };
      })
    : [];

  const transcription = text(record.transcription) || rawText;

  return normalizeDraft({
    fullName: text(record.fullName),
    firstName: text(record.firstName),
    lastName: text(record.lastName),
    jobTitle: text(record.jobTitle),
    company: text(record.company),
    phones,
    emails,
    website: text(record.website),
    linkedin: text(record.linkedin),
    street: text(record.street),
    city: text(record.city),
    region: text(record.region),
    postalCode: text(record.postalCode),
    country: text(record.country),
    notes: text(record.notes),
    confidence: asConfidence(record.confidence),
    rawText: transcription,
  });
}

export function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function findDuplicate(
  book: SavedContact[],
  draft: ContactDraft,
  exceptId?: string | null,
): SavedContact | null {
  const emails = new Set(draft.emails.map((email) => email.address.toLowerCase()).filter(Boolean));
  const phones = new Set(draft.phones.map((phone) => digits(phone.number)).filter((value) => value.length >= 7));
  return (
    book.find((contact) => {
      if (contact.id === exceptId) return false;
      if (contact.emails.some((email) => emails.has(email.address.toLowerCase()))) return true;
      return contact.phones.some((phone) => phones.has(digits(phone.number)));
    }) ?? null
  );
}

export function vcardFilename(contact: ContactDraft): string {
  const base = displayName(contact)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "contact"}.vcf`;
}
