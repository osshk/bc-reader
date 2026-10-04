"use client";

import { ContactBook } from "@/components/contact-book";
import { ReviewForm } from "@/components/review-form";
import { SettingsDialog } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultSettings,
  displayName,
  findDuplicate,
  normalizeDraft,
  splitPersonName,
  vcardFilename,
  type ContactDraft,
  type ReadEngine,
  type SavedContact,
  type Settings,
} from "@/lib/contact";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { parseCardText } from "@/lib/parse-text";
import { SAMPLE_LABELS, drawSample, type SampleId } from "@/lib/samples";
import { deliverVCard, deliveryMessage } from "@/lib/share";
import { loadBook, loadSettings, saveBook, saveSettings } from "@/lib/storage";
import { toVCard } from "@/lib/vcard";
import { Camera, Settings as SettingsIcon, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ServerConfig = { gemini: boolean; model: string };

type Stage =
  | { kind: "capture"; prepared: PreparedImage | null; error: string | null }
  | { kind: "reading"; prepared: PreparedImage; message: string }
  | {
      kind: "review";
      prepared: PreparedImage | null;
      draft: ContactDraft;
      engine: ReadEngine;
      savedId: string | null;
      banner: string | null;
      partsTouched: boolean;
    };

async function readWithGemini(prepared: PreparedImage, settings: Settings, serverGemini: boolean) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!serverGemini && settings.geminiKey.trim()) headers["x-gemini-key"] = settings.geminiKey.trim();
  const response = await fetch("/api/parse", {
    method: "POST",
    headers,
    body: JSON.stringify({ imageBase64: prepared.base64, mimeType: prepared.mimeType }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    contact?: ContactDraft;
  };
  if (!response.ok) {
    const error = new Error(payload.message || "The card could not be read.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (!payload.contact) throw new Error("Gemini returned an empty contact.");
  return payload.contact;
}

export function BrassApp() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [book, setBook] = useState<SavedContact[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [server, setServer] = useState<ServerConfig>({ gemini: false, model: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedContact | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "capture", prepared: null, error: null });

  useEffect(() => {
    setBook(loadBook());
    setSettings(loadSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveBook(book);
  }, [book, ready]);

  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((config: ServerConfig) => setServer(config))
      .catch(() => setServer({ gemini: false, model: "" }));
  }, []);

  function release(prepared: PreparedImage | null) {
    if (prepared?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(prepared.previewUrl);
  }

  async function takeFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStage((current) => ({
        kind: "capture",
        prepared: current.kind === "reading" ? current.prepared : current.kind === "capture" ? current.prepared : null,
        error: "Choose a photo of the card.",
      }));
      return;
    }
    try {
      const prepared = await prepareImage(file);
      setStage((current) => {
        const previous = current.kind === "review" ? current.prepared : current.prepared;
        if (previous && previous.previewUrl !== prepared.previewUrl) release(previous);
        return { kind: "capture", prepared, error: null };
      });
    } catch (error) {
      setStage((current) => ({
        kind: "capture",
        prepared: current.kind === "capture" ? current.prepared : null,
        error: error instanceof Error ? error.message : "That photo could not be opened.",
      }));
    }
  }

  async function readOnDevice(prepared: PreparedImage, message: string | null) {
    const blob = prepared.ocrBlob ? prepared.ocrBlob : await fetch(prepared.previewUrl).then((response) => response.blob());
    const { recognizeCard } = await import("@/lib/ocr");
    const text = await recognizeCard(blob, (progress) => {
      setStage({ kind: "reading", prepared, message: progress });
    });
    const draft = parseCardText(text);
    const empty = !displayName(draft) && draft.phones.length === 0 && draft.emails.length === 0;
    setStage({
      kind: "review",
      prepared,
      draft,
      engine: "device",
      savedId: null,
      partsTouched: false,
      banner: empty
        ? "Nothing readable came back. Type the contact, or try a sharper photo."
        : message,
    });
  }

  async function readPrepared(prepared: PreparedImage) {
    if (!prepared.base64) {
      setStage({
        kind: "capture",
        prepared,
        error: "This saved card has no photo to read again. Edit the fields instead.",
      });
      return;
    }
    const wantsDevice = settings.engine === "device";
    const hasGemini = server.gemini || settings.geminiKey.trim().length > 0;
    if (settings.engine === "gemini" && !hasGemini) {
      setStage({
        kind: "capture",
        prepared,
        error: "Add a Gemini API key in Settings, or switch the reader to this device.",
      });
      return;
    }

    setStage({
      kind: "reading",
      prepared,
      message: wantsDevice || !hasGemini ? "Reading the type on this device…" : "Sending the photo to Gemini…",
    });

    if (!wantsDevice && hasGemini) {
      try {
        const draft = await readWithGemini(prepared, settings, server.gemini);
        setStage({
          kind: "review",
          prepared,
          draft,
          engine: "gemini",
          savedId: null,
          banner: null,
          partsTouched: false,
        });
        return;
      } catch (error) {
        const status = error instanceof Error && "status" in error ? Number(error.status) : 0;
        const canFallback = settings.engine === "auto" && (status === 0 || status === 429 || status >= 500);
        const fallbackNote =
          status === 504
            ? "Gemini took too long, so this card was read on your device. Check the fields."
            : "Gemini was unavailable, so this card was read on your device. Check the fields.";
        if (!canFallback) {
          setStage({
            kind: "capture",
            prepared,
            error: error instanceof Error ? error.message : "The card could not be read.",
          });
          return;
        }
        await readOnDevice(prepared, fallbackNote);
        return;
      }
    }

    try {
      await readOnDevice(prepared, null);
    } catch (error) {
      setStage({
        kind: "capture",
        prepared,
        error: error instanceof Error ? error.message : "The on-device reader could not finish.",
      });
    }
  }

  function updateDraft(next: ContactDraft, source?: "fullName" | "parts") {
    setStage((current) => {
      if (current.kind !== "review") return current;
      let draft = next;
      let partsTouched = current.partsTouched;
      if (source === "parts") partsTouched = true;
      if (source === "fullName" && !partsTouched) {
        const parts = splitPersonName(next.fullName);
        draft = { ...next, firstName: parts.firstName, lastName: parts.lastName };
      }
      return { ...current, draft, partsTouched, banner: null };
    });
  }

  function persist(draft: ContactDraft, engine: ReadEngine, savedId: string | null, thumb: string) {
    const normalized = normalizeDraft(draft);
    if (!displayName(normalized)) return null;
    const now = new Date().toISOString();
    if (savedId) {
      setBook((current) =>
        current.map((contact) =>
          contact.id === savedId
            ? { ...contact, ...normalized, updatedAt: now, engine, thumbDataUrl: thumb || contact.thumbDataUrl }
            : contact,
        ),
      );
      return savedId;
    }
    const id = crypto.randomUUID();
    const saved: SavedContact = {
      ...normalized,
      id,
      createdAt: now,
      updatedAt: now,
      engine,
      thumbDataUrl: thumb,
    };
    setBook((current) => [saved, ...current]);
    return id;
  }

  function rememberCurrent() {
    if (stage.kind !== "review") return;
    const id = persist(stage.draft, stage.engine, stage.savedId, stage.prepared?.thumbDataUrl ?? "");
    if (!id) {
      setStage({ ...stage, banner: "Add a name before saving this card." });
      return;
    }
    setStage({ ...stage, savedId: id, banner: "Saved in this browser." });
  }

  async function addDrafts(drafts: ContactDraft[], rememberReview: boolean) {
    const readyContacts = drafts.map((draft) => normalizeDraft(draft)).filter((draft) => displayName(draft));
    if (readyContacts.length === 0) {
      const message = "Add a name so the contacts app has something to file.";
      if (!rememberReview) setNotice(message);
      if (stage.kind === "review") {
        setStage({ ...stage, banner: message });
      }
      return;
    }
    if (rememberReview && stage.kind === "review") {
      const id = persist(stage.draft, stage.engine, stage.savedId, stage.prepared?.thumbDataUrl ?? "");
      if (id) setStage({ ...stage, savedId: id });
    }
    try {
      const result = await deliverVCard(
        toVCard(readyContacts),
        readyContacts.length === 1 ? vcardFilename(readyContacts[0]!) : "brass-contacts.vcf",
      );
      const message = deliveryMessage(result, readyContacts.length);
      if (!rememberReview) setNotice(message);
      if (rememberReview) {
        setStage((current) => (current.kind === "review" ? { ...current, banner: message } : current));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = "The card file could not be handed over. Try again.";
      if (!rememberReview) setNotice(message);
      if (rememberReview) {
        setStage((current) => (current.kind === "review" ? { ...current, banner: message } : current));
      }
    }
  }

  async function loadSample(id: SampleId) {
    const blob = await drawSample(id);
    await takeFile(new File([blob], `${id}.jpg`, { type: "image/jpeg" }));
  }

  const prepared = stage.kind === "review" ? stage.prepared : stage.prepared;
  const duplicate =
    stage.kind === "review" ? findDuplicate(book, normalizeDraft(stage.draft), stage.savedId) : null;
  const readerLine = (() => {
    if (settings.engine === "device") return "Reading on this device. The photo never leaves the browser.";
    if (server.gemini) return `Gemini (${server.model}) is connected through Netlify.`;
    if (settings.geminiKey.trim()) return "Using the Gemini key saved in this browser.";
    if (settings.engine === "gemini") return "Gemini is selected, but no key is set yet.";
    return "No Gemini key yet. Cards are read on this device until you add one.";
  })();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <a href="#read" className="group flex items-center gap-2">
          <span className="bg-primary size-3 rounded-sm" aria-hidden />
          <span className="font-heading text-3xl italic tracking-tight">Brass</span>
        </a>
        <Button type="button" variant="outline" className="h-10" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
          Settings
        </Button>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <div className="grid gap-5 lg:sticky lg:top-6">
          {stage.kind !== "review" ? (
            <section id="read" className="grid gap-4" aria-labelledby="read-heading">
              <div>
                <h1 id="read-heading" className="font-heading max-w-xl text-4xl leading-tight tracking-tight sm:text-5xl">
                  Photograph a card. File the person.
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                  Brass reads the type, fills the contact, and hands it to the Contacts app on iPhone and Android.
                </p>
              </div>

              <div
                className={`relative overflow-hidden rounded-3xl border bg-card ${
                  dragging ? "border-primary" : "border-border"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void takeFile(event.dataTransfer.files[0] ?? null);
                }}
              >
                {prepared?.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prepared.previewUrl}
                    alt="Business card ready to read"
                    className="aspect-[1.7/1] w-full bg-[oklch(0.9_0.02_80)] object-contain"
                  />
                ) : (
                  <div className="flex aspect-[1.7/1] flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="font-heading text-2xl tracking-tight">Lay a card on the plate</p>
                    <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                      Take a photo, upload one, or drop it here. Keep the whole card in frame.
                    </p>
                  </div>
                )}
                {stage.kind === "reading" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 px-6 text-center">
                    <p className="font-heading text-2xl">{stage.message}</p>
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
                      <div className="bg-primary h-full w-1/2 animate-pulse" />
                    </div>
                  </div>
                ) : null}
              </div>

              <p className="sr-only" aria-live="polite">
                {stage.kind === "reading" ? stage.message : stage.error ?? ""}
              </p>

              {stage.kind === "capture" && stage.error ? (
                <p className="rounded-xl bg-[oklch(0.94_0.04_40)] px-3 py-2 text-sm leading-5 text-[oklch(0.4_0.12_30)]">
                  {stage.error}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" className="h-12 text-base" onClick={() => cameraRef.current?.click()} disabled={stage.kind === "reading"}>
                  <Camera />
                  Take photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base"
                  onClick={() => uploadRef.current?.click()}
                  disabled={stage.kind === "reading"}
                >
                  <Upload />
                  Upload
                </Button>
              </div>
              <input
                ref={cameraRef}
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  void takeFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <input
                ref={uploadRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void takeFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />

              {prepared?.base64 ? (
                <Button
                  type="button"
                  className="h-12 text-base"
                  disabled={stage.kind === "reading"}
                  onClick={() => void readPrepared(prepared)}
                >
                  Read this card
                </Button>
              ) : null}

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {(Object.keys(SAMPLE_LABELS) as SampleId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={() => void loadSample(id)}
                  >
                    {SAMPLE_LABELS[id]}
                  </button>
                ))}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{readerLine}</p>
            </section>
          ) : (
            <ReviewForm
              draft={stage.draft}
              previewUrl={stage.prepared?.previewUrl ?? null}
              engine={stage.engine}
              banner={stage.banner}
              duplicateName={duplicate ? displayName(duplicate) : null}
              saved={Boolean(stage.savedId)}
              onDraft={updateDraft}
              onAdd={() => void addDrafts([stage.draft], true)}
              onSave={rememberCurrent}
              onAnother={() => setStage({ kind: "capture", prepared: null, error: null })}
              onClose={() => setStage({ kind: "capture", prepared: stage.prepared, error: null })}
            />
          )}
        </div>

        <ContactBook
          contacts={book}
          activeId={stage.kind === "review" ? stage.savedId : null}
          ready={ready}
          onOpen={(contact) =>
            setStage({
              kind: "review",
              prepared: contact.thumbDataUrl
                ? {
                    base64: "",
                    mimeType: "image/jpeg",
                    previewUrl: contact.thumbDataUrl,
                    thumbDataUrl: contact.thumbDataUrl,
                  }
                : null,
              draft: contact,
              engine: contact.engine,
              savedId: contact.id,
              banner: null,
              partsTouched: true,
            })
          }
          onAdd={(contact) => void addDrafts([contact], false)}
          onDelete={setPendingDelete}
          onAddAll={() => void addDrafts(book, false)}
          notice={notice}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={setSettings}
        serverGemini={server.gemini}
        model={server.model}
        bookCount={book.length}
        onEmptyBook={() => setConfirmEmpty(true)}
      />

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingDelete ? displayName(pendingDelete) || "this card" : "this card"}?</DialogTitle>
            <DialogDescription>
              This drops them from Brass on this browser. It does not delete them from your phone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                setBook((current) => current.filter((contact) => contact.id !== pendingDelete.id));
                setStage((current) =>
                  current.kind === "review" && current.savedId === pendingDelete.id
                    ? { kind: "capture", prepared: null, error: null }
                    : current,
                );
                setPendingDelete(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty the book?</DialogTitle>
            <DialogDescription>
              {book.length === 1 ? "1 contact" : `${book.length} contacts`} will be removed from this browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmEmpty(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setBook([]);
                setConfirmEmpty(false);
                setSettingsOpen(false);
                setStage({ kind: "capture", prepared: null, error: null });
              }}
            >
              Empty book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
