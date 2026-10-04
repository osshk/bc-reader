export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export const GEMINI_PROMPT = `You read a photograph of a business card and extract the person on it.

Rules:
- Copy only what is printed. Never invent a phone number, email, title, or company.
- If a field is not on the card, return an empty string. If there are no phones or emails, return an empty array.
- fullName is the person's name as printed. Split it into firstName and lastName. Put additional given names in firstName and the surname in lastName.
- Keep phone numbers as printed, including extensions.
- label a phone mobile, work, home, fax, or other. Use mobile for cell or M, fax for fax, home for home, and work for office, direct, tel, or an unlabeled business number.
- label an email work, personal, or other.
- website is the company site, not a social profile. linkedin is the LinkedIn URL if one is printed.
- Put the street on street, and city, region, postal code, and country in their own fields. A phone number is never a street.
- On bilingual cards, keep the original-script name in fullName and put only the Latin given name and surname in firstName and lastName. For Hong Kong, city is the area such as Kowloon and country is Hong Kong. Keep websites like .com.hk intact.
- notes holds extra printed details that do not fit elsewhere, such as a tagline. Do not add commentary.
- transcription is the plain text you can read, with line breaks preserved and no commentary.
- confidence is high when the card is sharp and the fields are unambiguous, medium when layout makes a field uncertain, and low when the photo is blurry, cropped, or not a business card.`;

const STRING = { type: "STRING" } as const;

export const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    fullName: STRING,
    firstName: STRING,
    lastName: STRING,
    jobTitle: STRING,
    company: STRING,
    phones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING", enum: ["mobile", "work", "home", "fax", "other"] },
          number: STRING,
        },
        required: ["label", "number"],
      },
    },
    emails: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING", enum: ["work", "personal", "other"] },
          address: STRING,
        },
        required: ["label", "address"],
      },
    },
    website: STRING,
    linkedin: STRING,
    street: STRING,
    city: STRING,
    region: STRING,
    postalCode: STRING,
    country: STRING,
    notes: STRING,
    transcription: STRING,
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
  },
  required: [
    "fullName",
    "firstName",
    "lastName",
    "jobTitle",
    "company",
    "phones",
    "emails",
    "website",
    "linkedin",
    "street",
    "city",
    "region",
    "postalCode",
    "country",
    "notes",
    "transcription",
    "confidence",
  ],
} as const;

export function geminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const safe = configured.replace(/[^a-zA-Z0-9._-]/g, "");
  return safe || DEFAULT_GEMINI_MODEL;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Gemini did not return contact JSON.");
  }
}
