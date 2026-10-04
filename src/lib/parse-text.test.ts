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
});
