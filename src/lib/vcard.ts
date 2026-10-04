import { displayName, normalizeDraft, type ContactDraft } from "@/lib/contact";

const TEL_TYPE: Record<ContactDraft["phones"][number]["label"], string> = {
  mobile: "CELL,VOICE",
  work: "WORK,VOICE",
  home: "HOME,VOICE",
  fax: "FAX",
  other: "VOICE",
};

const EMAIL_TYPE: Record<ContactDraft["emails"][number]["label"], string> = {
  work: "WORK,INTERNET",
  personal: "HOME,INTERNET",
  other: "INTERNET",
};

function escapeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  let output = line.slice(0, 75);
  let index = 75;
  while (index < line.length) {
    output += `\r\n ${line.slice(index, index + 74)}`;
    index += 74;
  }
  return output;
}

function field(name: string, value: string): string | null {
  if (!value) return null;
  return fold(`${name}:${escapeValue(value)}`);
}

function oneCard(input: ContactDraft): string {
  const contact = normalizeDraft(input);
  const full = displayName(contact) || "Unknown";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//Brass//Business Card Scanner//EN",
    fold(`N;CHARSET=UTF-8:${escapeValue(contact.lastName)};${escapeValue(contact.firstName)};;;`),
    fold(`FN;CHARSET=UTF-8:${escapeValue(full)}`),
    field("NICKNAME;CHARSET=UTF-8", contact.chineseName),
    contact.company ? fold(`ORG;CHARSET=UTF-8:${escapeValue(contact.company)}`) : null,
    field("TITLE;CHARSET=UTF-8", contact.jobTitle),
    ...contact.phones.map((phone) => fold(`TEL;TYPE=${TEL_TYPE[phone.label]}:${escapeValue(phone.number)}`)),
    ...contact.emails.map((email) => fold(`EMAIL;TYPE=${EMAIL_TYPE[email.label]}:${escapeValue(email.address)}`)),
    field("URL", contact.website),
    contact.linkedin ? fold(`X-SOCIALPROFILE;TYPE=linkedin:${escapeValue(contact.linkedin)}`) : null,
    contact.linkedin ? fold(`URL;TYPE=linkedin:${escapeValue(contact.linkedin)}`) : null,
    fold(
      `ADR;TYPE=WORK;CHARSET=UTF-8:;;${escapeValue(contact.street)};${escapeValue(contact.city)};${escapeValue(contact.region)};${escapeValue(contact.postalCode)};${escapeValue(contact.country)}`,
    ),
    field("NOTE;CHARSET=UTF-8", contact.notes),
    "END:VCARD",
  ].filter((line): line is string => Boolean(line));

  const addressBlank =
    !contact.street && !contact.city && !contact.region && !contact.postalCode && !contact.country;
  const body = addressBlank ? lines.filter((line) => !line.startsWith("ADR;")) : lines;
  return `${body.join("\r\n")}\r\n`;
}

export function toVCard(input: ContactDraft | ContactDraft[]): string {
  const contacts = Array.isArray(input) ? input : [input];
  return contacts.map((contact) => oneCard(contact)).join("");
}
