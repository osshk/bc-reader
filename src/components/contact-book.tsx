"use client";

import { Button } from "@/components/ui/button";
import { displayName, type SavedContact } from "@/lib/contact";
import { Smartphone, Trash2 } from "lucide-react";

export function ContactBook({
  contacts,
  activeId,
  ready,
  onOpen,
  onAdd,
  onDelete,
  onAddAll,
  notice,
}: {
  contacts: SavedContact[];
  activeId: string | null;
  ready: boolean;
  onOpen: (contact: SavedContact) => void;
  onAdd: (contact: SavedContact) => void;
  onDelete: (contact: SavedContact) => void;
  onAddAll: () => void;
  notice: string | null;
}) {
  return (
    <section className="grid gap-4" aria-labelledby="book-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Book</p>
          <h2 id="book-heading" className="font-heading text-3xl tracking-tight">
            Filed
          </h2>
        </div>
        {contacts.length > 0 ? (
          <Button type="button" variant="outline" className="h-10" onClick={onAddAll}>
            <Smartphone />
            Add everyone
          </Button>
        ) : null}
      </div>
      {notice ? <p className="rounded-xl bg-accent px-3 py-2 text-sm leading-5">{notice}</p> : null}

      {!ready ? <p className="text-sm text-muted-foreground">Opening your book…</p> : null}

      {ready && contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 bg-card/70 px-5 py-8">
          <p className="font-heading text-2xl tracking-tight">No one filed yet.</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            The first card you read lands here. From this list you can drop one person, or everyone, into the contacts
            app.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-3">
        {contacts.map((contact) => {
          const name = displayName(contact) || "Unnamed card";
          const detail = [contact.jobTitle, contact.company].filter(Boolean).join(", ");
          const reach = contact.emails[0]?.address || contact.phones[0]?.number || "";
          const active = contact.id === activeId;
          return (
            <li key={contact.id}>
              <article
                className={`rounded-2xl border bg-card p-4 ${active ? "border-primary" : "border-border"}`}
              >
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => onOpen(contact)}>
                  {contact.thumbDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={contact.thumbDataUrl}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="bg-muted font-heading flex h-14 w-20 shrink-0 items-center justify-center rounded-md text-lg">
                      {name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">{name}</span>
                    {detail ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{detail}</span> : null}
                    {reach ? <span className="mt-0.5 block truncate text-sm">{reach}</span> : null}
                    <span className="mt-1 block text-xs tracking-wide text-primary uppercase">
                      {contact.engine === "gemini" ? "Gemini" : "On device"}
                    </span>
                  </span>
                </button>
                <div className="mt-3 flex gap-2">
                  <Button type="button" className="h-10 flex-1" onClick={() => onAdd(contact)}>
                    <Smartphone />
                    Add to phone
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10"
                    aria-label={`Remove ${name} from Brass`}
                    onClick={() => onDelete(contact)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
