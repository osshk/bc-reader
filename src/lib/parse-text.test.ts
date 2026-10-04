import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCardText } from "./parse-text";

describe("parseCardText", () => {
  it("reads a US studio card", () => {
    const contact = parseCardText(`NORTHWIND STUDIO
Maya Chen
Product Design Director
maya@northwind.studio
+1 415 555 0148
northwind.studio
548 Market Street
San Francisco, CA 94104`);

    assert.equal(contact.fullName, "Maya Chen");
    assert.equal(contact.firstName, "Maya");
    assert.equal(contact.lastName, "Chen");
    assert.equal(contact.jobTitle, "Product Design Director");
    assert.equal(contact.company, "Northwind Studio");
    assert.equal(contact.emails[0]?.address, "maya@northwind.studio");
    assert.equal(contact.phones[0]?.number, "+1 415 555 0148");
    assert.equal(contact.website, "https://northwind.studio");
    assert.equal(contact.street, "548 Market Street");
    assert.equal(contact.city, "San Francisco");
    assert.equal(contact.region, "CA");
    assert.equal(contact.postalCode, "94104");
    assert.equal(contact.confidence, "high");
  });

  it("reads a UK card with labeled lines and LinkedIn", () => {
    const contact = parseCardText(`HALE & BIRCH
Julian Okonkwo
Partner
M  +44 20 7946 0991
E  j.okonkwo@halebirch.com
W  halebirch.com
in linkedin.com/in/julianokonkwo
12 Greencoat Place
London SW1P 1PH
United Kingdom`);

    assert.equal(contact.fullName, "Julian Okonkwo");
    assert.equal(contact.firstName, "Julian");
    assert.equal(contact.lastName, "Okonkwo");
    assert.equal(contact.jobTitle, "Partner");
    assert.equal(contact.company, "Hale & Birch");
    assert.equal(contact.phones[0]?.label, "mobile");
    assert.equal(contact.phones[0]?.number, "+44 20 7946 0991");
    assert.equal(contact.emails[0]?.address, "j.okonkwo@halebirch.com");
    assert.equal(contact.website, "https://halebirch.com");
    assert.equal(contact.linkedin, "https://linkedin.com/in/julianokonkwo");
    assert.equal(contact.street, "12 Greencoat Place");
    assert.equal(contact.city, "London");
    assert.equal(contact.postalCode, "SW1P 1PH");
    assert.equal(contact.country, "United Kingdom");
  });

  it("keeps an accented given name intact", () => {
    const contact = parseCardText(`José Alvarez
Counsel
jose@example.com
415-555-0199`);
    assert.equal(contact.fullName, "José Alvarez");
    assert.equal(contact.firstName, "José");
    assert.equal(contact.lastName, "Alvarez");
    assert.equal(contact.jobTitle, "Counsel");
  });

  it("returns an empty draft for blank input", () => {
    const contact = parseCardText("   \n");
    assert.equal(contact.fullName, "");
    assert.equal(contact.confidence, "low");
    assert.equal(contact.phones.length, 0);
  });

  it("reads a bilingual Hong Kong card", () => {
    const contact = parseCardText(`CANDAS CHOW 周珮延
Senior Marketing Manager
Mobile - 9676 7716
HOT TOYS LIMITED
香港九龍觀塘鴻圖道57號南洋廣場22樓01-03A室
Unit 01-03A, 22/F., Nanyang Plaza, 57 Hung To Road, Kwun Tong,
Kowloon, Hong Kong.
Tel (852)2836 3295 Direct (852)3951 3913 Fax (852)2783 9359
Email candas.chow@hottoys.com.hk Website www.hottoys.com.hk`);

    assert.equal(contact.fullName, "Candas Chow");
    assert.equal(contact.chineseName, "周珮延");
    assert.equal(contact.firstName, "Candas");
    assert.equal(contact.lastName, "Chow");
    assert.equal(contact.jobTitle, "Senior Marketing Manager");
    assert.equal(contact.company, "Hot Toys Limited");
    assert.deepEqual(
      contact.phones.map((phone) => `${phone.label}:${phone.number}`),
      ["mobile:9676 7716", "work:(852)2836 3295", "work:(852)3951 3913", "fax:(852)2783 9359"],
    );
    assert.equal(contact.emails[0]?.address, "candas.chow@hottoys.com.hk");
    assert.equal(contact.website, "https://www.hottoys.com.hk");
    assert.equal(contact.street, "Unit 01-03A, 22/F., Nanyang Plaza, 57 Hung To Road, Kwun Tong");
    assert.equal(contact.city, "Kowloon");
    assert.equal(contact.country, "Hong Kong");
    assert.match(contact.notes, /香港/);
    assert.equal(contact.confidence, "high");
  });

  it("reads the on-device transcript of that card", () => {
    const contact = parseCardText(`~~ CANDAS CHOW 周 姵 延
Senior Marketing Manager
Mobile - 9676 7716 |
HOT TOYS LIMITED.
ERAANMBEANNS7RRH¥NB22#K01-03AK
Unit 01-03A, 22/F., Nanyang Plaza, 57 Hung To Road, Kwun Tong,
Kowloon, Hong Kong.
Tel -(852)2836 3295 Direct - (852)3951 3913 Fax - (852)2783 9359
Email - candas.chow@hottoys.com.hk Website - www.hottoys.com.hk`);

    assert.equal(contact.fullName, "Candas Chow");
    assert.equal(contact.chineseName, "周姵延");
    assert.equal(contact.firstName, "Candas");
    assert.equal(contact.lastName, "Chow");
    assert.equal(contact.company, "Hot Toys Limited");
    assert.equal(contact.phones[0]?.label, "mobile");
    assert.equal(contact.phones[0]?.number, "9676 7716");
    assert.equal(contact.phones[3]?.label, "fax");
    assert.equal(contact.phones[3]?.number, "(852)2783 9359");
    assert.equal(contact.website, "https://www.hottoys.com.hk");
    assert.equal(contact.street, "Unit 01-03A, 22/F., Nanyang Plaza, 57 Hung To Road, Kwun Tong");
    assert.equal(contact.city, "Kowloon");
    assert.equal(contact.country, "Hong Kong");
    assert.doesNotMatch(contact.street, /9676/);
    assert.doesNotMatch(contact.notes, /ERAAN|HOT TOYS/i);
  });

  it("keeps a misread mobile number out of the street", () => {
    const contact = parseCardText(`CANDAS CHOW / if &&
Senior Marketing Manager
9676 7716, pi 0 2m DRE en on na Ree Ln Be
HOT TOYS LIMITED
Kowloon, H¢`);

    assert.equal(contact.fullName, "Candas Chow");
    assert.equal(contact.chineseName, "");
    assert.equal(contact.company, "Hot Toys Limited");
    assert.equal(contact.phones[0]?.number, "9676 7716");
    assert.notEqual(contact.phones[0]?.label, "fax");
    assert.equal(contact.street, "");
    assert.equal(contact.city, "Kowloon");
    assert.equal(contact.country, "Hong Kong");
    assert.doesNotMatch(`${contact.street}\n${contact.company}`, /9676|if &&/);
  });

  it("keeps a failed Chinese address line out of notes", () => {
    const contact = parseCardText(`CANDAS CHOW 周珮延
HOT TOYS LIMITED
EENEEEHEEREBS7 RAE XEIFE22M01-03AE
Unit 01-03A, 22/F., Nanyang Plaza, 57 Hung To Road, Kwun Tong
Kowloon, Hong Kong.`);

    assert.equal(contact.fullName, "Candas Chow");
    assert.equal(contact.chineseName, "周珮延");
    assert.equal(contact.street, "Unit 01-03A, 22/F., Nanyang Plaza, 57 Hung To Road, Kwun Tong");
    assert.equal(contact.notes, "");
  });
});
