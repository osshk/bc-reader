"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "@/components/review-form";
import { displayName, findDuplicate, normalizeDraft, pullChineseName, splitPersonName, type SavedContact, type Settings } from "@/lib/contact";
import { prepareImage } from "@/lib/image";
import { readCard } from "@/lib/read-card";
import { runBatch } from "@/lib/batch";
import { deliverVCard, deliveryMessage } from "@/lib/share";
import { toVCard } from "@/lib/vcard";

type Row = {
  file: File;
  status: "waiting" | "reading" | "ready" | "error";
  message: string;
  contact?: SavedContact;
  selected: boolean;
  partsTouched?: boolean;
};

export function BatchReader({ files, settings, serverGemini, book, onSave, onClose }: {
  files: File[];
  settings: Settings;
  serverGemini: boolean;
  book: SavedContact[];
  onSave: (contacts: SavedContact[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => files.map((file) => ({ file, status: "waiting", message: "Waiting", selected: false })));
  const [running, setRunning] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const stop = useRef(false);
  // A run uses one snapshot. Changing settings or saving results never restarts it.
  const snapshot = useRef({ settings, serverGemini, book, rows });
  useEffect(() => { snapshot.current = { settings, serverGemini, book, rows }; }, [settings, serverGemini, book, rows]);

  useEffect(() => {
    let disposed = false;
    stop.current = false;
    const initial = snapshot.current;
    const pending = initial.rows.map((row, index) => ({ row, index }))
      .filter(({ row }) => row.status !== "ready");
    const seen = [...initial.book, ...initial.rows.flatMap((row) => row.contact ? [row.contact] : [])];
    const patch = (index: number, values: Partial<Row>) => {
      if (!disposed) setRows((current) => current.map((row, i) => i === index ? { ...row, ...values } : row));
    };
    void runBatch(pending, async ({ row, index }) => {
      patch(index, { status: "reading", message: "Preparing photo…" });
      if (!row.file.type.startsWith("image/")) throw new Error("Choose a JPEG or PNG photo of a card.");
      const prepared = await prepareImage(row.file);
      try {
        if (disposed) throw new Error("Stopped");
        const result = await readCard(prepared, initial.settings, initial.serverGemini,
          (message) => patch(index, { message }));
        const now = new Date().toISOString();
        const contact: SavedContact = { ...normalizeDraft(result.draft), id: crypto.randomUUID(),
          engine: result.engine, createdAt: now, updatedAt: now, thumbDataUrl: prepared.thumbDataUrl };
        const duplicate = findDuplicate(seen, contact);
        seen.push(contact);
        return { contact, selected: Boolean(displayName(contact)) && !duplicate,
          message: result.banner ?? (contact.confidence === "low" ? "Check the fields — this card was hard to read." : "Ready to review") };
      } finally {
        URL.revokeObjectURL(prepared.previewUrl);
      }
    }, (position, result) => {
      const index = pending[position].index;
      patch(index, "value" in result ? { status: "ready", ...result.value } : { status: "error", message: result.error });
    }, () => disposed || stop.current).finally(() => { if (!disposed) setRunning(false); });
    return () => { disposed = true; };
  }, [attempt]);

  const selected = rows.flatMap((row) => row.selected && row.contact && displayName(normalizeDraft(row.contact)) ? [row.contact] : []);
  const finished = rows.filter((row) => row.status === "ready" || row.status === "error").length;
  const editRow = editing === null ? null : rows[editing];
  const duplicateFor = (index: number, contact: SavedContact) => findDuplicate(
    [...book, ...rows.slice(0, index).flatMap((row) => row.contact ? [row.contact] : [])], contact, contact.id);

  async function save(addToPhone: boolean) {
    if (delivering || !selected.length) return;
    setDelivering(true);
    try {
      // Persist synchronously before iOS navigates to the contact import response.
      const contacts = selected.map((contact) => ({ ...contact, ...normalizeDraft(contact), updatedAt: new Date().toISOString() }));
      onSave(contacts);
      if (addToPhone) {
        const result = await deliverVCard(toVCard(contacts), "bc-reader-batch.vcf");
        setNotice(deliveryMessage(result, contacts.length));
      } else setNotice(`${contacts.length} contacts saved in this browser.`);
    } catch (error) {
      setNotice(error instanceof DOMException && error.name === "AbortError"
        ? "Import cancelled. Your contacts are saved in the book."
        : "Could not finish saving or importing. Keep this batch open and try again.");
    } finally { setDelivering(false); }
  }

  return <section className="grid gap-4" aria-labelledby="batch-heading">
    <h1 id="batch-heading" className="font-heading text-4xl">Read a batch</h1>
    <p className="text-sm text-muted-foreground">One card per photo. Check the results, then add the selected contacts together. Your phone asks you to confirm the import.</p>
    <p role="status">{finished} of {rows.length} photos processed{running ? "…" : "."}</p>
    <progress className="w-full accent-primary" value={finished} max={rows.length} aria-label="Batch progress" />
    {running ? <Button variant="outline" onClick={() => { stop.current = true; setNotice("Stopping after the current card…"); }}>Stop after this card</Button> : null}
    {notice ? <p role="status" className="rounded-xl bg-accent p-3 text-sm">{notice}</p> : null}
    {editRow?.contact && editing !== null ? <ReviewForm
      batchReview draft={editRow.contact} engine={editRow.contact.engine} previewUrl={editRow.contact.thumbDataUrl}
      banner={editRow.message} duplicateName={(() => { const duplicate = duplicateFor(editing, editRow.contact!); return duplicate ? displayName(duplicate) : null; })()}
      saved={false} onAdd={() => {}} onSave={() => {}} onAnother={() => setEditing(null)} onClose={() => setEditing(null)}
      onDraft={(draft, source) => setRows((current) => current.map((row, index) => {
        if (index !== editing || !row.contact) return row;
        const partsTouched = row.partsTouched || source === "parts";
        if (source === "fullName") {
          const names = pullChineseName(draft.fullName, draft.chineseName);
          draft = { ...draft, ...names, ...(partsTouched ? {} : splitPersonName(names.fullName)) };
        }
        return { ...row, contact: { ...row.contact, ...draft }, partsTouched };
      }))} /> : <>
      <ul className="grid gap-3">
        {rows.map((row, index) => {
          const contact = row.contact;
          const duplicate = contact ? duplicateFor(index, { ...contact, ...normalizeDraft(contact) }) : null;
          const named = contact && Boolean(displayName(normalizeDraft(contact)));
          return <li key={index} className="rounded-xl border bg-card p-3">
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-5" aria-label={`Include ${contact ? displayName(contact) || row.file.name : row.file.name}`}
                checked={row.selected && Boolean(named)} disabled={running || !named || delivering}
                onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item))} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{contact ? displayName(contact) || "Name needed" : row.file.name}</p>
                <p className="break-words text-sm text-muted-foreground">{contact ? [contact.company, contact.emails[0]?.address, contact.phones[0]?.number].filter(Boolean).join(" · ") : row.message}</p>
                {contact ? <p className="text-sm text-muted-foreground">{row.message}</p> : null}
                {duplicate ? <p className="text-sm">Possible duplicate of {displayName(duplicate)}. Select only if you want another copy.</p> : null}
                {contact && !named ? <p className="text-sm">Edit this card to add a name before importing.</p> : null}
              </div>
              {contact ? <Button variant="outline" disabled={running || delivering} onClick={() => setEditing(index)}>Edit</Button> : null}
            </div>
          </li>;
        })}
      </ul>
      {!running ? <div className="grid gap-2">
        <Button disabled={!selected.length || delivering} onClick={() => void save(true)}>Add {selected.length} selected to phone</Button>
        <Button variant="outline" disabled={!selected.length || delivering} onClick={() => void save(false)}>Save selected in book</Button>
        {rows.some((row) => row.status !== "ready") ? <Button variant="outline" disabled={delivering} onClick={() => { setRunning(true); setNotice(null); setAttempt((value) => value + 1); }}>Retry unread cards</Button> : null}
        <Button variant="ghost" disabled={delivering} onClick={() => {
          if (rows.some((row) => row.contact && !book.some((contact) => contact.id === row.contact!.id && JSON.stringify(normalizeDraft(contact)) === JSON.stringify(normalizeDraft(row.contact!)))) && !window.confirm("Leave this batch? Unsaved contacts will be lost.")) return;
          onClose();
        }}>Finish batch</Button>
      </div> : null}
    </>}
  </section>;
}
