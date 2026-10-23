import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toVCard } from "./vcard";
import type { ContactDraft } from "./contact";

function draft(overrides: Partial<ContactDraft> = {}): ContactDraft {
  return {
    fullName: "Maya Chen",
    chineseName: "",
    firstName: "Maya",
    lastName: "Chen",
    jobTitle: "Product Design Director",
    company: "Northwind Studio",
    phones: [{ label: "mobile", number: "+1 415 555 0148" }],
    emails: [{ label: "work", address: "maya@northwind.studio" }],
    website: "northwind.studio",
    linkedin: "",
    street: "548 Market Street",
    city: "San Francisco",
    region: "CA",
    postalCode: "94104",
    country: "United States",
    notes: "Met at the ferry building.",
    confidence: "high",
    rawText: "",
    ...overrides,
  };
}

function unfold(vcard: string): string {
  return vcard.replace(/\r\n[ \t]/g, "");
}

describe("toVCard", () => {
  it("writes a version 3 card with CRLF and escaped commas", () => {
    const vcard = toVCard(draft({ notes: "Line one\nLine, two" }));
    const flat = unfold(vcard);
    assert.doesNotMatch(vcard, /CHARSET=/);
    assert.match(vcard, /BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
    assert.match(flat, /N:Chen;Maya;;;/);
    assert.match(flat, /FN:Maya Chen/);
    assert.doesNotMatch(flat, /NICKNAME/);
    assert.match(flat, /ORG:Northwind Studio/);
    assert.match(flat, /TITLE:Product Design Director/);
    assert.match(flat, /TEL;TYPE=CELL,VOICE:\+1 415 555 0148/);
    assert.match(flat, /EMAIL;TYPE=WORK,INTERNET:maya@northwind\.studio/);
    assert.match(flat, /URL:https:\/\/northwind\.studio/);
    assert.match(flat, /ADR;TYPE=WORK:;;548 Market Street;San Francisco;CA;94104;United States/);
    assert.match(flat, /NOTE:Line one\\nLine\\, two/);
    assert.match(vcard, /END:VCARD\r\n$/);
  });

  it("stacks every contact in one file and skips blank numbers", () => {
    const vcard = toVCard([
      draft(),
      draft({
        fullName: "Julian Okonkwo",
        firstName: "Julian",
        lastName: "Okonkwo",
        company: "Hale & Birch",
        phones: [
          { label: "work", number: "123" },
          { label: "work", number: "+44 20 7946 0991" },
        ],
        emails: [],
        website: "",
        street: "",
        city: "",
        region: "",
        postalCode: "",
        country: "",
        notes: "",
        jobTitle: "",
      }),
    ]);
    assert.equal(vcard.match(/BEGIN:VCARD/g)?.length, 2);
    assert.match(vcard, /FN:Julian Okonkwo/);
    assert.match(vcard, /ORG:Hale & Birch/);
    assert.doesNotMatch(vcard, /TEL;TYPE=WORK,VOICE:123/);
    assert.match(vcard, /TEL;TYPE=WORK,VOICE:\+44 20 7946 0991/);
    assert.match(toVCard(draft({ chineseName: "周珮延" })), /NICKNAME:周珮延/);
    assert.match(toVCard(draft({ chineseName: "周珮延" })), /FN:Maya Chen/);
    const julian = vcard.split("BEGIN:VCARD")[2] ?? "";
    assert.doesNotMatch(julian, /^ADR/m);
  });

  it("preserves bilingual organization and title as separate fields", () => {
    const company = "One Small Step 一小步; Education, Ltd. \\ Asia";
    const title = "Education Director 教育總監";
    const flat = unfold(toVCard(draft({ company, jobTitle: title })));
    assert.ok(flat.includes("ORG:One Small Step 一小步\\; Education\\, Ltd. \\\\ Asia\r\n"));
    assert.ok(flat.includes(`TITLE:${title}\r\n`));
  });

  it("folds by UTF-8 bytes without corrupting Chinese or supplementary characters", () => {
    const companies = [
      "環球創意教育科技發展集團有限公司".repeat(5),
      "A".repeat(70) + "🌏 Education; Hong Kong",
      "A".repeat(70) + "𠮷野家香港有限公司",
    ];
    for (const company of companies) {
      const vcard = toVCard(draft({ company }));
      assert.match(vcard, /\r\n /);
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(vcard));
      const flat = unfold(decoded);
      const escaped = company.replace(/;/g, "\\;");
      assert.ok(flat.includes(`ORG:${escaped}\r\n`));
      assert.ok(!flat.includes("\uFFFD"));
      for (const physical of decoded.split("\r\n")) {
        assert.ok(Buffer.byteLength(physical, "utf8") <= 75, `Line exceeds 75 bytes: ${physical}`);
      }
    }
  });

});
