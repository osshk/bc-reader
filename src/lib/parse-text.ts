import {
  emptyDraft,
  normalizeDraft,
  splitPersonName,
  type ContactDraft,
  type EmailLabel,
  type PhoneLabel,
} from "@/lib/contact";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_SOURCE =
  "(?:\\+\\d{1,3}[\\s.-]*)?(?:\\(\\d{1,4}\\)[\\s.-]*)?\\d{2,4}(?:[\\s.-]*\\d{2,4}){1,4}";
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>)]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|studio|co(?:\.uk)?|uk|us|ca|de|fr|au|app|dev|design|me|ai|biz|hk|cn|jp|tw|sg|nz|ie|eu|in|kr)(?:\/[^\s<>)]*)?/gi;
const COMPANY_RE =
  /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|gmbh|corp|corporation|company|studio|studios|group|labs|lab|partners|agency|associates|plc|llp|atelier|pte|bhd)\b\.?/i;
const TITLE_RE =
  /\b(director|manager|engineer|designer|design|founder|partner|consultant|officer|president|analyst|lead|head|coordinator|specialist|architect|developer|producer|editor|counsel|attorney|advisor|adviser|associate|principal|chief|ceo|cto|cfo|coo|cmo|vp|vice|marketing|sales|recruiter|photographer|writer|strategist|accountant|broker|agent|creative|product|operations|counselor)\b/i;
const TITLE_WORD =
  /^(partner|founder|consultant|principal|associate|director|manager|president|counsel|attorney|broker|agent|designer|engineer|developer|analyst|recruiter|producer|editor|architect|ceo|cto|cfo|coo)$/i;
const STRONG_STREET_RE =
  /\b(street|avenue|road|boulevard|lane|drive|place|court|square|terrace|floor|suite|building|unit|plaza|centre|center|tower|house|way)\b|(?:^|[\s,])\d{1,3}\s*\/\s*f\b/i;
const WEAK_STREET_RE = /\b(st|ave|rd|blvd|ln|dr|pl|ct|sq|ste|bldg)\b\.?/i;
const US_CITY_RE = /^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const UK_CITY_RE = /^(.+?)\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
const COUNTRY_RE =
  /^(united states|united states of america|usa|u\.s\.a\.|united kingdom|uk|great britain|england|canada|australia|ireland|germany|france|india|singapore|japan|netherlands|new zealand|mexico|spain|italy|china|hong kong)$/i;
const NAME_TOKEN = /^(?:[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*|[\u3400-\u9FFF]{1,4})$/;

function phonePattern(): RegExp {
  return new RegExp(PHONE_SOURCE, "g");
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
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

function companyScore(line: string): number {
  const cleaned = line.replace(/\.+$/g, "").trim();
  if (!cleaned || looksLikeTitle(cleaned)) return 0;
  if (COMPANY_RE.test(cleaned)) return 3;
  if (!cleaned.includes("&")) return 0;
  const words = cleaned.split(/\s+/);
  if (words.length < 2 || words.length > 6) return 0;
  if (/[^A-Za-z0-9\s&.'’-]/u.test(cleaned)) return 0;
  const letterWords = words.filter((word) => /[A-Za-z]{2,}/.test(word));
  return letterWords.length >= 2 ? 1 : 0;
}

function isNameToken(word: string): boolean {
  return NAME_TOKEN.test(word);
}

function nameCandidate(line: string): string | null {
  const cleaned = tidy(
    line.replace(/^[^A-Za-z\u3400-\u9FFF]+/u, "").replace(/[^A-Za-z\u3400-\u9FFF'’.]+$/u, ""),
  );
  if (!cleaned || /\d|@|https?:|www\./i.test(cleaned)) return null;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const run: string[] = [];
  for (const word of words) {
    if (!isNameToken(word)) break;
    run.push(word);
  }
  if (run.length < 2 || run.length > 8) return null;
  const candidate = run.join(" ");
  if (looksLikeTitle(candidate) || companyScore(candidate) >= 1) return null;
  return candidate;
}

function boundedPhone(value: string, offset: number, match: string): boolean {
  const before = offset > 0 ? value[offset - 1] : "";
  const after = offset + match.length < value.length ? value[offset + match.length] : "";
  if (before && /[\dA-Za-z]/.test(before)) return false;
  if (after && /[\dA-Za-z]/.test(after)) return false;
  const count = digitCount(match);
  return count >= 7 && count <= 15;
}

function findLabeledPhones(line: string): { label: PhoneLabel; number: string }[] {
  const found: { label: PhoneLabel; number: string }[] = [];
  const pattern = phonePattern();
  let match: RegExpExecArray | null;
  let previous = 0;
  while ((match = pattern.exec(line))) {
    const number = match[0];
    if (!boundedPhone(line, match.index, number)) continue;
    found.push({ label: phoneLabelFromContext(line.slice(previous, match.index)), number: tidy(number) });
    previous = match.index + number.length;
  }
  return found;
}

function phoneLabelFromContext(before: string): PhoneLabel {
  const words = [...before.toLowerCase().matchAll(/\b(fax|mobile|cell|mobi|home|direct|tel|telephone|phone|office|work|main)\b/g)];
  const word = words.at(-1)?.[1];
  if (word === "fax") return "fax";
  if (word === "mobile" || word === "cell" || word === "mobi") return "mobile";
  if (word === "home") return "home";
  if (word) return "work";
  if (/(?:^|[\s|])m\s*[-.:|]*\s*$/i.test(before)) return "mobile";
  return "work";
}

function emailLabel(line: string): EmailLabel {
  if (/\b(personal|home|private)\b/i.test(line)) return "personal";
  return "work";
}

function tidyCountry(line: string): string {
  if (/^(usa|u\.s\.a\.|united states|united states of america)$/i.test(line)) return "United States";
  if (/^(uk|united kingdom|great britain|england)$/i.test(line)) return "United Kingdom";
  if (/^hong\s*kong$/i.test(line)) return "Hong Kong";
  return prettyLabel(line);
}

function stripContactTokens(line: string): string {
  let value = line.replace(EMAIL_RE, " ");
  value = value.replace(phonePattern(), (match, offset: number, source: string) =>
    boundedPhone(source, offset, match) ? " " : match,
  );
  value = value.replace(URL_RE, " ");
  value = value.replace(
    /\b(mobile|cell|office|direct|phone|tel|telephone|fax|email|e-mail|web|website|linkedin)\b[:.]?/gi,
    " ",
  );
  value = value.replace(/^[A-Za-z]\s*[:.|-]\s*/, " ");
  value = tidy(value.replace(/^[\s:|./-]+|[\s:|./-]+$/g, ""));
  if (/^[A-Za-z]{1,2}$/i.test(value)) return "";
  if (/^(in|tel|www|web)$/i.test(value)) return "";
  return value;
}

function normalizeFoundUrl(raw: string): string {
  return raw.trim().replace(/[),.;]+$/g, "");
}

function looksLikeStreet(line: string): boolean {
  if (STRONG_STREET_RE.test(line)) return true;
  const letters = lettersOnly(line).length;
  const digits = digitCount(line);
  if (WEAK_STREET_RE.test(line) && /^\d{1,6}\s+[A-Za-z]/.test(line) && digits <= 6 && letters >= 4) return true;
  if (/^\d{1,6}\s+[A-Za-z]{3,}/.test(line) && digits <= 6 && letters >= 4) return true;
  return false;
}

function isGarbage(line: string): boolean {
  const compact = line.replace(/\s+/g, "");
  if (!compact) return true;
  if (/^[^A-Za-z0-9\u3400-\u9FFF]+$/u.test(compact)) return true;
  if (/[\u3400-\u9FFF]/u.test(line)) return false;
  if (US_CITY_RE.test(line) || UK_CITY_RE.test(line)) return false;
  if (!line.includes(" ") && /[A-Za-z]{6,}/.test(line) && /\d/.test(line) && !/@/.test(line) && !URL_RE.test(line)) {
    URL_RE.lastIndex = 0;
    return true;
  }
  URL_RE.lastIndex = 0;
  const letters = (line.match(/[A-Za-z]/g) ?? []).length;
  const vowels = (line.match(/[AEIOUaeiou]/g) ?? []).length;
  const symbols = (line.match(/[^A-Za-z0-9\s.,'’&()/:-]/g) ?? []).length;
  if (letters >= 8 && vowels / letters < 0.22 && !STRONG_STREET_RE.test(line) && !COMPANY_RE.test(line)) return true;
  if (symbols >= 2 && letters > 0 && vowels / Math.max(letters, 1) < 0.28 && !STRONG_STREET_RE.test(line)) return true;
  const tokens = line.split(/\s+/).filter(Boolean);
  const mixed = tokens.filter((token) => /[A-Za-z]/.test(token) && /\d/.test(token));
  if (mixed.length > 0 && mixed.length * 2 >= tokens.length && !STRONG_STREET_RE.test(line) && !COMPANY_RE.test(line)) {
    return true;
  }
  return false;
}

function stripEdge(line: string): string {
  return tidy(line.replace(/^[,\s;|]+|[,\s;|]+$/g, ""));
}

function peelLocality(line: string): { rest: string; city: string; country: string } | null {
  const cleaned = line.replace(/\.+$/g, "").trim();
  if (/^hong\s*kong$/i.test(cleaned)) return { rest: "", city: "", country: "Hong Kong" };
  if (/^kowloon\b/i.test(cleaned)) return { rest: "", city: "Kowloon", country: "Hong Kong" };
  const withDistrict = cleaned.match(/^(.*?)(?:,\s*)?\bkowloon\b\s*,\s*hong\s*kong$/i);
  if (withDistrict) return { rest: tidy(withDistrict[1] ?? ""), city: "Kowloon", country: "Hong Kong" };
  const countryOnly = cleaned.match(/^(.*?)[,\s]+hong\s*kong$/i);
  if (countryOnly) {
    const rest = tidy(countryOnly[1] ?? "");
    if (!rest || looksLikeStreet(rest)) return { rest, city: "", country: "Hong Kong" };
    return { rest: "", city: prettyLabel(rest), country: "Hong Kong" };
  }
  return null;
}

function mostlyCjk(line: string): boolean {
  const cjk = (line.match(/[\u3400-\u9FFF]/gu) ?? []).length;
  const latin = (line.match(/[A-Za-z]/g) ?? []).length;
  return cjk >= 4 && cjk > latin;
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
  const cjkLines: string[] = [];

  for (const line of lines) {
    if (isGarbage(line)) continue;
    if (mostlyCjk(line)) {
      cjkLines.push(line);
      continue;
    }
    const locality = peelLocality(line);
    if (locality) {
      if (!address.city && locality.city) address.city = locality.city;
      if (!address.country && locality.country) address.country = locality.country;
      if (locality.rest && looksLikeStreet(locality.rest)) streets.push(stripEdge(locality.rest));
      else if (locality.rest) address.other.push(locality.rest);
      continue;
    }
    const bare = line.replace(/\.+$/g, "").trim();
    if (COUNTRY_RE.test(bare)) {
      address.country = tidyCountry(bare);
      continue;
    }
    const us = bare.match(US_CITY_RE);
    if (us) {
      address.city = prettyLabel(us[1] ?? "");
      address.region = (us[2] ?? "").toUpperCase();
      address.postalCode = us[3] ?? "";
      continue;
    }
    const uk = bare.match(UK_CITY_RE);
    if (uk && !looksLikeStreet(bare)) {
      address.city = prettyLabel(uk[1] ?? "");
      address.postalCode = tidy(uk[2] ?? "").toUpperCase();
      continue;
    }
    if (looksLikeStreet(bare)) {
      streets.push(stripEdge(bare));
      continue;
    }
    address.other.push(line);
  }

  address.street = streets.join(", ");
  if (!address.street && cjkLines.length > 0) address.street = cjkLines.join(" ");
  else address.other.push(...cjkLines);
  return address;
}

export function parseQuality(raw: string): number {
  const draft = parseCardText(raw);
  let score = 0;
  if (draft.fullName) score += 5;
  if (draft.chineseName) score += 2;
  if (draft.jobTitle) score += 2;
  if (draft.company) score += 4;
  if (draft.street) score += 4;
  if (draft.city) score += 2;
  if (draft.country) score += 2;
  score += Math.min(draft.phones.length, 4) * 2;
  score += Math.min(draft.emails.length, 2) * 3;
  if (draft.website) score += 2;
  if (draft.phones.some((phone) => phone.label === "fax")) score += 1;
  return score;
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
  const seenPhones = new Set<string>();
  const consumed = new Set<number>();

  lines.forEach((line, index) => {
    for (const address of line.match(EMAIL_RE) ?? []) {
      emails.push({ label: emailLabel(line), address });
    }
    for (const phone of findLabeledPhones(line)) {
      const key = phone.number.replace(/\D/g, "");
      if (seenPhones.has(key)) continue;
      seenPhones.add(key);
      phones.push(phone);
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
    .filter((line) => line && !isGarbage(line));

  let companyIndex = -1;
  let bestCompany = 0;
  remaining.forEach((line, index) => {
    const score = companyScore(line);
    if (score > bestCompany) {
      bestCompany = score;
      companyIndex = index;
    }
  });
  const company = companyIndex >= 0 ? prettyLabel(remaining[companyIndex] ?? "").replace(/\.+$/g, "") : "";
  const afterCompany = remaining.filter((_, index) => index !== companyIndex);

  const titleIndex = afterCompany.findIndex(looksLikeTitle);
  const jobTitle = titleIndex >= 0 ? prettyLabel(afterCompany[titleIndex] ?? "") : "";
  const afterTitle = afterCompany.filter((_, index) => index !== titleIndex);

  let nameLine = "";
  let nameIndex = -1;
  afterTitle.forEach((line, index) => {
    if (nameIndex >= 0) return;
    const candidate = nameCandidate(line);
    if (!candidate) return;
    nameLine = prettyLabel(candidate);
    nameIndex = index;
  });
  const afterName = afterTitle.filter((_, index) => index !== nameIndex);

  const address = parseAddress(afterName);
  const notes = address.other.filter((line) => !isGarbage(line));
  const parts = splitPersonName(nameLine);
  const reach = phones.length > 0 || emails.length > 0;
  const confidence = nameLine && reach ? "high" : nameLine || reach ? "medium" : "low";

  return normalizeDraft({
    fullName: nameLine,
    chineseName: "",
    firstName: parts.firstName,
    lastName: parts.lastName,
    jobTitle,
    company,
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
