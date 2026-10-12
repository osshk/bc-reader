import { parsePhoneNumberFromString, getCountryCallingCode, type CountryCode } from "libphonenumber-js/max";

// Phones are stored and exported in international form ("+852 2836 3295") so
// iPhone and Android can both dial them from anywhere, including abroad.

const COUNTRY_HINTS: [RegExp, CountryCode][] = [
  [/hong\s*kong|\bhk\b|香港/i, "HK"],
  [/macau|macao|澳門/i, "MO"],
  [/taiwan|台灣/i, "TW"],
  [/singapore/i, "SG"],
  [/china|\bprc\b|中國/i, "CN"],
  [/japan|日本/i, "JP"],
  [/korea/i, "KR"],
  [/malaysia/i, "MY"],
  [/thailand/i, "TH"],
  [/philippines/i, "PH"],
  [/indonesia/i, "ID"],
  [/vietnam/i, "VN"],
  [/india\b/i, "IN"],
  [/australia/i, "AU"],
  [/new zealand/i, "NZ"],
  [/united kingdom|\buk\b|england|scotland|wales|great britain/i, "GB"],
  [/ireland/i, "IE"],
  [/france/i, "FR"],
  [/germany/i, "DE"],
  [/switzerland/i, "CH"],
  [/italy/i, "IT"],
  [/spain/i, "ES"],
  [/netherlands/i, "NL"],
  [/united arab emirates|\buae\b|dubai/i, "AE"],
  [/canada/i, "CA"],
  [/united states|\busa?\b|u\.s\.a?\./i, "US"],
];

export function countryFromText(...values: string[]): CountryCode | undefined {
  const joined = values.filter(Boolean).join(" ");
  if (!joined) return undefined;
  for (const [pattern, code] of COUNTRY_HINTS) if (pattern.test(joined)) return code;
  return undefined;
}

function splitExtension(value: string): { main: string; ext: string } {
  const match = value.match(/^(.*?)(?:\s*(?:ext\.?|extension|x|#|,|轉|内線|內線)\s*(\d{1,6}))\s*$/i);
  if (match && /\d{6,}/.test((match[1] ?? "").replace(/\D/g, ""))) {
    return { main: match[1] ?? "", ext: match[2] ?? "" };
  }
  return { main: value, ext: "" };
}

function firstDigitGroup(value: string): string {
  return value.replace(/^[^\d]*/, "").match(/^\d+/)?.[0] ?? "";
}

export function formatPhone(raw: string, defaultCountry: CountryCode = "HK"): string {
  const original = raw.replace(/\s+/g, " ").trim();
  if (!original) return "";
  const { main, ext } = splitExtension(original);
  const digits = main.replace(/\D/g, "");
  if (digits.length < 7) return original;

  let text = main.trim().replace(/^00(?=\d)/, "+").replace(/^\+\s*\(?\s*0*/, "+");
  let parsed = undefined as ReturnType<typeof parsePhoneNumberFromString>;

  if (text.startsWith("+")) {
    parsed = parsePhoneNumberFromString(text);
  } else {
    // "(852) 2836 3295", "852-2836-3295", "852 9676 7716": printed country code without a plus.
    const group = firstDigitGroup(text);
    const asIntl = parsePhoneNumberFromString(`+${digits}`);
    const ccPrinted =
      asIntl?.isValid() &&
      (group === asIntl.countryCallingCode ||
        (/^\(\s*\d{1,4}\s*\)/.test(text) && text.match(/\d+/)?.[0] === asIntl.countryCallingCode) ||
        (group.length === digits.length && digits.length > 9 && digits.startsWith(asIntl.countryCallingCode)));
    const asLocal = parsePhoneNumberFromString(text, defaultCountry);
    const localDigits = asLocal?.nationalNumber ?? "";
    const localIsWholeNumber = asLocal?.isValid() && localDigits.length >= digits.length - 1;
    if (ccPrinted && !localIsWholeNumber) parsed = asIntl;
    else if (asLocal?.isValid()) parsed = asLocal;
    else if (ccPrinted) parsed = asIntl;
  }

  if (!parsed || !parsed.isValid()) {
    // Unknown shape: leave as printed, but if it clearly starts with the home country code, add the plus.
    const cc = getCountryCallingCode(defaultCountry);
    if (!original.startsWith("+") && digits.startsWith(cc) && digits.length > cc.length + 6) {
      text = `+${main.trim()}`;
      return ext ? `${text},${ext}` : text;
    }
    return original;
  }

  const formatted = parsed.formatInternational();
  // A comma is a dial pause on both iPhone and Android, so extensions still dial.
  return ext ? `${formatted},${ext}` : formatted;
}
