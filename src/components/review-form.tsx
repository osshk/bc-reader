"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EMAIL_LABELS,
  PHONE_LABELS,
  displayName,
  type ContactDraft,
  type Email,
  type EmailLabel,
  type Phone,
  type PhoneLabel,
  type ReadEngine,
} from "@/lib/contact";
import { Plus, Smartphone, XIcon } from "lucide-react";
import type { ReactNode } from "react";

const PHONE_TEXT: Record<PhoneLabel, string> = {
  mobile: "Mobile",
  work: "Work",
  home: "Home",
  fax: "Fax",
  other: "Other",
};

const EMAIL_TEXT: Record<EmailLabel, string> = {
  work: "Work",
  personal: "Personal",
  other: "Other",
};

const selectClass =
  "h-11 w-[7.25rem] shrink-0 rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function ReviewForm({
  draft,
  previewUrl,
  engine,
  banner,
  duplicateName,
  saved,
  onDraft,
  onAdd,
  onSave,
  onAnother,
  onClose,
}: {
  draft: ContactDraft;
  previewUrl: string | null;
  engine: ReadEngine;
  banner: string | null;
  duplicateName: string | null;
  saved: boolean;
  onDraft: (draft: ContactDraft, source?: "fullName" | "parts") => void;
  onAdd: () => void;
  onSave: () => void;
  onAnother: () => void;
  onClose: () => void;
}) {
  const named = Boolean(displayName(draft).trim());

  function patch(partial: Partial<ContactDraft>, source?: "fullName" | "parts") {
    onDraft({ ...draft, ...partial }, source);
  }

  function updatePhone(index: number, phone: Phone) {
    const phones = draft.phones.map((item, itemIndex) => (itemIndex === index ? phone : item));
    patch({ phones });
  }

  function updateEmail(index: number, email: Email) {
    const emails = draft.emails.map((item, itemIndex) => (itemIndex === index ? email : item));
    patch({ emails });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
            {engine === "gemini" ? "Read by Gemini" : "Read on this device"}
          </p>
          <h2 className="font-heading mt-1 text-3xl tracking-tight">Check the card</h2>
        </div>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="The card Brass just read"
            className="h-16 w-28 rounded-lg border border-border object-cover"
          />
        ) : null}
      </div>

      {engine === "device" ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm leading-5 text-muted-foreground">
          On-device reading misses more than Gemini. Compare every field with the card before you file it.
        </p>
      ) : null}
      {draft.confidence === "low" ? (
        <p className="rounded-xl bg-[oklch(0.94_0.04_70)] px-3 py-2 text-sm leading-5 text-[oklch(0.38_0.06_55)]">
          This card was hard to read. Fill in anything that came back blank.
        </p>
      ) : null}
      {duplicateName ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm leading-5">
          This looks like <span className="font-medium">{duplicateName}</span>, already in your book.
        </p>
      ) : null}
      {banner ? <p className="rounded-xl bg-accent px-3 py-2 text-sm leading-5">{banner}</p> : null}

      <div className="grid gap-4">
        <Field id="full-name" label="Name">
          <Input
            id="full-name"
            value={draft.fullName}
            autoComplete="off"
            className="h-12 text-lg md:text-lg"
            onChange={(event) => patch({ fullName: event.target.value }, "fullName")}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="first-name" label="First name">
            <Input
              id="first-name"
              value={draft.firstName}
              autoComplete="off"
              className="h-11"
              onChange={(event) => patch({ firstName: event.target.value }, "parts")}
            />
          </Field>
          <Field id="last-name" label="Last name">
            <Input
              id="last-name"
              value={draft.lastName}
              autoComplete="off"
              className="h-11"
              onChange={(event) => patch({ lastName: event.target.value }, "parts")}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">First and last are what the contacts app files.</p>
        <Field id="chinese-name" label="Chinese name">
          <Input
            id="chinese-name"
            value={draft.chineseName}
            autoComplete="off"
            lang="zh-Hant"
            className="h-12 text-lg md:text-lg"
            onChange={(event) => patch({ chineseName: event.target.value })}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted-foreground">Saved on the phone as the nickname, beside the English name.</p>
        <Field id="job-title" label="Title">
          <Input
            id="job-title"
            value={draft.jobTitle}
            autoComplete="off"
            className="h-11"
            onChange={(event) => patch({ jobTitle: event.target.value })}
          />
        </Field>
        <Field id="company" label="Company">
          <Input
            id="company"
            value={draft.company}
            autoComplete="off"
            className="h-11"
            onChange={(event) => patch({ company: event.target.value })}
          />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Phones</legend>
        {draft.phones.map((phone, index) => (
          <div key={`phone-${index}`} className="flex gap-2">
            <select
              aria-label={`Phone ${index + 1} label`}
              className={selectClass}
              value={phone.label}
              onChange={(event) => updatePhone(index, { ...phone, label: event.target.value as PhoneLabel })}
            >
              {PHONE_LABELS.map((label) => (
                <option key={label} value={label}>
                  {PHONE_TEXT[label]}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Phone ${index + 1}`}
              inputMode="tel"
              autoComplete="off"
              className="h-11"
              value={phone.number}
              onChange={(event) => updatePhone(index, { ...phone, number: event.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`Remove phone ${index + 1}`}
              onClick={() => patch({ phones: draft.phones.filter((_, itemIndex) => itemIndex !== index) })}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-10 justify-start"
          onClick={() => patch({ phones: [...draft.phones, { label: "work", number: "" }] })}
        >
          <Plus />
          Add a phone
        </Button>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Email</legend>
        {draft.emails.map((email, index) => (
          <div key={`email-${index}`} className="flex gap-2">
            <select
              aria-label={`Email ${index + 1} label`}
              className={selectClass}
              value={email.label}
              onChange={(event) => updateEmail(index, { ...email, label: event.target.value as EmailLabel })}
            >
              {EMAIL_LABELS.map((label) => (
                <option key={label} value={label}>
                  {EMAIL_TEXT[label]}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Email ${index + 1}`}
              inputMode="email"
              autoComplete="off"
              className="h-11"
              value={email.address}
              onChange={(event) => updateEmail(index, { ...email, address: event.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`Remove email ${index + 1}`}
              onClick={() => patch({ emails: draft.emails.filter((_, itemIndex) => itemIndex !== index) })}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-10 justify-start"
          onClick={() => patch({ emails: [...draft.emails, { label: "work", address: "" }] })}
        >
          <Plus />
          Add an email
        </Button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="website" label="Website">
          <Input
            id="website"
            inputMode="url"
            autoComplete="off"
            className="h-11"
            value={draft.website}
            onChange={(event) => patch({ website: event.target.value })}
          />
        </Field>
        <Field id="linkedin" label="LinkedIn">
          <Input
            id="linkedin"
            inputMode="url"
            autoComplete="off"
            className="h-11"
            value={draft.linkedin}
            onChange={(event) => patch({ linkedin: event.target.value })}
          />
        </Field>
        <Field id="street" label="Street" className="sm:col-span-2">
          <Input
            id="street"
            autoComplete="off"
            className="h-11"
            value={draft.street}
            onChange={(event) => patch({ street: event.target.value })}
          />
        </Field>
        <Field id="city" label="City">
          <Input
            id="city"
            autoComplete="off"
            className="h-11"
            value={draft.city}
            onChange={(event) => patch({ city: event.target.value })}
          />
        </Field>
        <Field id="region" label="State or region">
          <Input
            id="region"
            autoComplete="off"
            className="h-11"
            value={draft.region}
            onChange={(event) => patch({ region: event.target.value })}
          />
        </Field>
        <Field id="postal" label="Postal code">
          <Input
            id="postal"
            autoComplete="off"
            className="h-11"
            value={draft.postalCode}
            onChange={(event) => patch({ postalCode: event.target.value })}
          />
        </Field>
        <Field id="country" label="Country">
          <Input
            id="country"
            autoComplete="off"
            className="h-11"
            value={draft.country}
            onChange={(event) => patch({ country: event.target.value })}
          />
        </Field>
      </div>

      <Field id="notes" label="Notes">
        <Textarea
          id="notes"
          value={draft.notes}
          autoComplete="off"
          className="min-h-20"
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </Field>

      {draft.rawText ? (
        <details className="rounded-xl border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Text read off the card</summary>
          <pre className="mt-2 font-sans text-sm leading-5 whitespace-pre-wrap text-muted-foreground">
            {draft.rawText}
          </pre>
        </details>
      ) : null}

      <div className="sticky bottom-3 z-10 grid gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_12px_40px_-24px_rgba(28,25,21,0.7)] backdrop-blur">
        <Button type="button" className="h-12 text-base" disabled={!named} onClick={onAdd}>
          <Smartphone />
          Add to phone
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={onSave}>
            {saved ? "Update book" : "Save in book"}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={onAnother}>
            Read another
          </Button>
        </div>
        <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onClose}>
          Back to the plate
        </button>
        <p className="text-center text-xs leading-4 text-muted-foreground">
          iPhone opens a contact card. Android imports a vCard. Both ask you to confirm.
        </p>
      </div>
    </div>
  );
}
