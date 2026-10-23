// Synthetic contacts for Apple's Contacts parser (macOS or iOS simulator).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyDraft } from "../src/lib/contact";
import { toVCard } from "../src/lib/vcard";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: node --import tsx scripts/vcard-fixtures.ts <output-directory>");
const companies = [
  "One Small Step, Limited",
  "一小步教育有限公司",
  "One Small Step 一小步有限公司",
  "環球創意教育科技發展集團有限公司".repeat(5),
  "A".repeat(70) + "🌏 Education; Hong Kong",
  "A".repeat(70) + "𠮷野家香港有限公司",
  "Design \\ Research; Asia, Ltd.",
];
const contacts = companies.map((company, index) => ({
  ...emptyDraft(), fullName: `Test Person ${index}`, firstName: "Test", lastName: `Person ${index}`,
  company, jobTitle: "Director 總監",
}));
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "contacts.vcf"), toVCard(contacts));
writeFileSync(join(directory, "expected.json"), JSON.stringify(contacts));
