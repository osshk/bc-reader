import assert from "node:assert/strict";
import { test } from "node:test";
import { runBatch } from "./batch";
import { readCard } from "./read-card";
import { emptyDraft } from "./contact";
import { GET, POST } from "../app/api/vcard/route";
import { NextRequest } from "next/server";
import { toVCard } from "./vcard";

test("batch continues after an unreadable photo and runs only one read at a time", async () => {
  let active = 0;
  const results: unknown[] = [];
  await runBatch([1, 2, 3], async (item) => {
    assert.equal(++active, 1);
    await Promise.resolve();
    active--;
    if (item === 2) throw new Error("Unreadable photo");
    return item;
  }, (index, result) => results.push({ index, ...result }), () => false);
  assert.deepEqual(results, [{ index: 0, value: 1 }, { index: 1, error: "Unreadable photo" }, { index: 2, value: 3 }]);
});

test("stop keeps the current result and does not start another card", async () => {
  let stopped = false;
  const results: number[] = [];
  await runBatch([1, 2, 3], async (item) => { stopped = true; return item; }, (_, result) => {
    if ("value" in result) results.push(result.value);
    stopped = true;
  }, () => stopped);
  assert.deepEqual(results, [1]);
});

test("Gemini reads return contacts and explicit Gemini mode does not swallow errors", async (t) => {
  const prepared = { base64: "photo", mimeType: "image/jpeg" as const, previewUrl: "blob:photo", thumbDataUrl: "" };
  const contact = { ...emptyDraft(), fullName: "Maya Chen" };
  t.mock.method(globalThis, "fetch", async () => Response.json({ contact }));
  assert.equal((await readCard(prepared, { engine: "gemini", geminiKey: "key" }, false, () => {})).draft.fullName, "Maya Chen");
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Invalid key" }, { status: 401 }));
  await assert.rejects(readCard(prepared, { engine: "auto", geminiKey: "key" }, false, () => {}), /Invalid key/);
  await assert.rejects(readCard(prepared, { engine: "gemini", geminiKey: "" }, false, () => {}), /Add a Gemini/);
});

test("iPhone POST returns a large bilingual batch intact, and GET still works", async () => {
  const contacts = Array.from({ length: 40 }, (_, i) => ({ ...emptyDraft(), fullName: `Person ${i}`, chineseName: "陳大文", notes: "Contact notes ".repeat(100) }));
  const vcf = toVCard(contacts);
  const d = Buffer.from(vcf).toString("base64url");
  assert.ok(d.length > 60000);
  const response = await POST(new NextRequest("http://localhost/api/vcard", {
    method: "POST", body: new URLSearchParams({ d, n: "batch" }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/vcard; charset=utf-8");
  assert.equal(await response.text(), vcf);
  assert.equal(GET(new NextRequest(`http://localhost/api/vcard?d=${Buffer.from(toVCard(contacts[0])).toString("base64url")}`)).status, 200);
  assert.equal((await POST(new NextRequest("http://localhost/api/vcard", { method: "POST", body: "d=invalid" }))).status, 400);
});
