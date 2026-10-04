import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toVCard } from "./vcard";
import type { ContactDraft } from "./contact";

function draft(overrides: Partial<ContactDraft> = {}): ContactDraft {
  return {
    fullName: "Maya Chen",
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
    assert.match(vcard, /BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
    assert.match(vcard, /\r\n /);
    assert.match(flat, /N;CHARSET=UTF-8:Chen;Maya;;;/);
    assert.match(flat, /FN;CHARSET=UTF-8:Maya Chen/);
    assert.match(flat, /ORG;CHARSET=UTF-8:Northwind Studio/);
    assert.match(flat, /TITLE;CHARSET=UTF-8:Product Design Director/);
    assert.match(flat, /TEL;TYPE=CELL,VOICE:\+1 415 555 0148/);
    assert.match(flat, /EMAIL;TYPE=WORK,INTERNET:maya@northwind\.studio/);
    assert.match(flat, /URL:https:\/\/northwind\.studio/);
    assert.match(flat, /ADR;TYPE=WORK;CHARSET=UTF-8:;;548 Market Street;San Francisco;CA;94104;United States/);
    assert.match(flat, /NOTE;CHARSET=UTF-8:Line one\\nLine\\, two/);
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
    assert.match(vcard, /FN;CHARSET=UTF-8:Julian Okonkwo/);
    assert.match(vcard, /ORG;CHARSET=UTF-8:Hale & Birch/);
    assert.doesNotMatch(vcard, /TEL;TYPE=WORK,VOICE:123/);
    assert.match(vcard, /TEL;TYPE=WORK,VOICE:\+44 20 7946 0991/);
    const julian = vcard.split("BEGIN:VCARD")[2] ?? "";
    assert.doesNotMatch(julian, /^ADR/m);
  });
});
