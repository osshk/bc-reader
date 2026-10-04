import {
  emptyDraft,
  normalizeDraft,
  splitPersonName,
  type ContactDraft,
  type EmailLabel,
  type PhoneLabel,
} from "@/lib/contact";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE =
  /(?:\+\d[\d\s().-]{6,}\d|\(\d{2,4}\)[\d\s().-]{5,}\d|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b|\b\d{10,15}\b)/g;
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>)]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|studio|co(?:\.uk)?|uk|us|ca|de|fr|au|app|dev|design|me|ai|biz)(?:\/[^\s<>)]*)?/gi;
const COMPANY_RE =
  /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|gmbh|corp|corporation|company|studio|studios|group|labs|lab|partners|agency|associates|plc|llp|atelier)\b\.?/i;
const TITLE_RE =
  /\b(director|manager|engineer|designer|design|founder|partner|consultant|officer|president|analyst|lead|head|coordinator|specialist|architect|developer|producer|editor|counsel|attorney|advisor|adviser|associate|principal|chief|ceo|cto|cfo|coo|cmo|vp|vice|marketing|sales|recruiter|photographer|writer|strategist|accountant|broker|agent|creative|product|operations|counselor)\b/i;
const TITLE_WORD =
  /^(partner|founder|consultant|principal|associate|director|manager|president|counsel|attorney|broker|agent|designer|engineer|developer|analyst|recruiter|producer|editor|architect|ceo|cto|cfo|coo)$/i;
const STREET_RE =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|place|pl|court|ct|square|sq|terrace|floor|suite|ste|building|bldg)\b\.?/i;
const US_CITY_RE = /^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const UK_CITY_RE = /^(.+?)\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
const COUNTRY_RE =
  /^(united states|united states of america|usa|u\.s\.a\.|united kingdom|uk|great britain|england|canada|australia|ireland|germany|france|india|singapore|japan|netherlands|new zealand|mexico|spain|italy)$/i;

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function lettersOnly(value: string): string {
  return value.replace(/[^A-Za-z]/g, "");
}

function prettyLabel(line: string): string {
  const letters = lettersOnly(line);
  const shouting = letters.length > 3 && letters === letters.toUpperCase();
  if (!shouting) return line;
  return line
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b(And|Of|The)\b/g, (word) => word.toLowerCase());
}

function looksLikeTitle(line: string): boolean {
  const words = line.split(/\s+/);
  if (words.length > 8) return false;
  if (TITLE_WORD.test(line.trim())) return true;
  return TITLE_RE.test(line) && words.length <= 6;
}

function looksLikeCompany(line: string): boolean {
  if (COMPANY_RE.test(line)) return true;
  if (looksLikeTitle(line)) return false;
  if (line.includes("&") && line.split(/\s+/).length <= 6) return true;
  const letters = lettersOnly(line);
  return letters.length >= 4 && letters === letters.toUpperCase() && !/\d/.test(line);
}

function looksLikeName(line: string): boolean {
  if (looksLikeCompany(line) || looksLikeTitle(line)) return false;
  if (/\d|@|https?:|www\./i.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((word) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*$/.test(word));
}

function findPhones(line: string): string[] {
  return (line.match(PHONE_RE) ?? []).filter((match) => {
    const count = match.replace(/\D/g, "").length;
    return count >= 7 && count <= 15;
  });
}

function phoneLabel(line: string): PhoneLabel {
  const lower = line.toLowerCase();
  if (/\bfax\b/.test(lower)) return "fax";
  if (/\b(mobile|cell|mobi)\b/.test(lower) || /^\s*m\b/i.test(line)) return "mobile";
  if (/\bhome\b/.test(lower)) return "home";
  if (/\b(work|office|direct|tel|phone|main)\b/.test(lower) || /^\s*[tpo]\b/i.test(line)) return "work";
  return "work";
}

function emailLabel(line: string): EmailLabel {
  if (/\b(personal|home|private)\b/i.test(line)) return "personal";
  return "work";
}

function tidyCountry(line: string): string {
  if (/^(usa|u\.s\.a\.|united states|united states of america)$/i.test(line)) return "United States";
  if (/^(uk|united kingdom|great britain|england)$/i.test(line)) return "United Kingdom";
  return prettyLabel(line);
}

function stripContactTokens(line: string): string {
  let value = line.replace(EMAIL_RE, " ").replace(PHONE_RE, " ").replace(URL_RE, " ");
  value = value.replace(
    /\b(mobile|cell|office|direct|phone|tel|telephone|fax|email|e-mail|web|website|linkedin)\b[:.]?/gi,
    " ",
  );
  value = value.replace(/^[A-Za-z]\s*[:.|-]\s*/, " ");
  value = tidy(value.replace(/^[\s:|./-]+|[\s:|./-]+$/g, ""));
  if (/^[A-Za-z]$/.test(value)) return "";
  return value;
}

function normalizeFoundUrl(raw: string): string {
  return raw.trim().replace(/[),.;]+$/g, "");
}

type Address = {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  other: string[];
};

function parseAddress(lines: string[]): Address {
  const address: Address = {
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    other: [],
  };
  const streets: string[] = [];

  for (const line of lines) {
    if (COUNTRY_RE.test(line)) {
      address.country = tidyCountry(line);
      continue;
    }
    const us = line.match(US_CITY_RE);
    if (us) {
      address.city = prettyLabel(us[1] ?? "");
      address.region = (us[2] ?? "").toUpperCase();
      address.postalCode = us[3] ?? "";
      continue;
    }
    const uk = line.match(UK_CITY_RE);
    if (uk && !STREET_RE.test(line)) {
      address.city = prettyLabel(uk[1] ?? "");
      address.postalCode = tidy(uk[2] ?? "").toUpperCase();
      continue;
    }
    if (STREET_RE.test(line) || /^\d{1,6}\s+\S+/.test(line)) {
      streets.push(line);
      continue;
    }
    address.other.push(line);
  }

  address.street = streets.join(", ");
  return address;
}

export function parseCardText(raw: string): ContactDraft {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => tidy(line))
    .filter(Boolean);

  if (lines.length === 0) return emptyDraft();

  const phones: ContactDraft["phones"] = [];
  const emails: ContactDraft["emails"] = [];
  const websites: string[] = [];
  let linkedin = "";
  const consumed = new Set<number>();

  lines.forEach((line, index) => {
    for (const address of line.match(EMAIL_RE) ?? []) {
      emails.push({ label: emailLabel(line), address });
    }
    for (const number of findPhones(line)) {
      phones.push({ label: phoneLabel(line), number: tidy(number) });
    }
    const withoutEmails = line.replace(EMAIL_RE, " ");
    for (const url of withoutEmails.match(URL_RE) ?? []) {
      const normalized = normalizeFoundUrl(url);
      if (/linkedin\.com/i.test(normalized)) {
        if (!linkedin) linkedin = normalized;
      } else if (!websites.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        websites.push(normalized);
      }
    }
    if (!stripContactTokens(line)) consumed.add(index);
  });

  const remaining = lines
    .filter((_, index) => !consumed.has(index))
    .map((line) => stripContactTokens(line))
    .filter(Boolean);

  const companyIndex = remaining.findIndex(looksLikeCompany);
  const company = companyIndex >= 0 ? prettyLabel(remaining[companyIndex] ?? "") : "";
  const afterCompany = remaining.filter((_, index) => index !== companyIndex);

  const titleIndex = afterCompany.findIndex(looksLikeTitle);
  const jobTitle = titleIndex >= 0 ? prettyLabel(afterCompany[titleIndex] ?? "") : "";
  const afterTitle = afterCompany.filter((_, index) => index !== titleIndex);

  const nameIndex = afterTitle.findIndex(looksLikeName);
  const nameLine = nameIndex >= 0 ? prettyLabel(afterTitle[nameIndex] ?? "") : "";
  const afterName = afterTitle.filter((_, index) => index !== nameIndex);

  const address = parseAddress(afterName);
  let resolvedCompany = company;
  const notes: string[] = [];
  for (const line of address.other) {
    if (!resolvedCompany && line.split(/\s+/).length <= 4 && !/[.!?]$/.test(line)) {
      resolvedCompany = prettyLabel(line);
      continue;
    }
    notes.push(line);
  }

  const parts = splitPersonName(nameLine);
  const reach = phones.length > 0 || emails.length > 0;
  const confidence = nameLine && reach ? "high" : nameLine || reach ? "medium" : "low";

  return normalizeDraft({
    fullName: nameLine,
    firstName: parts.firstName,
    lastName: parts.lastName,
    jobTitle,
    company: resolvedCompany,
    phones,
    emails,
    website: websites[0] ?? "",
    linkedin,
    street: address.street,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    notes: notes.join("\n"),
    confidence,
    rawText: raw.trim(),
  });
}
