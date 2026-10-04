"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EngineChoice, Settings } from "@/lib/contact";

const CHOICES: Array<{ id: EngineChoice; title: string; detail: string }> = [
  {
    id: "auto",
    title: "Automatic",
    detail: "Use Gemini when a key is available. Otherwise read the card in this browser.",
  },
  {
    id: "gemini",
    title: "Gemini only",
    detail: "Sharper on worn or photographed cards. The photo is sent to Google and not stored.",
  },
  {
    id: "device",
    title: "This device only",
    detail: "Private. The photo never leaves the browser. Expect to correct more fields.",
  },
];

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  serverGemini,
  model,
  bookCount,
  onEmptyBook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (settings: Settings) => void;
  serverGemini: boolean;
  model: string;
  bookCount: number;
  onEmptyBook: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">How cards are read</DialogTitle>
          <DialogDescription>
            A key in Netlify is used first and never shown here. A key typed below stays in this browser.
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl bg-muted px-3 py-2 text-sm leading-5">
          {serverGemini
            ? `Gemini is connected on the server (${model}).`
            : "No server key is set. Paste one here, or keep reading on this device."}
        </p>

        <fieldset className="grid gap-2">
          <legend className="sr-only">Reader</legend>
          {CHOICES.map((choice) => (
            <label
              key={choice.id}
              className={`grid cursor-pointer gap-1 rounded-xl border px-3 py-2 ${
                settings.engine === choice.id ? "border-primary bg-accent/60" : "border-border"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="engine"
                  value={choice.id}
                  checked={settings.engine === choice.id}
                  onChange={() => onChange({ ...settings, engine: choice.id })}
                />
                {choice.title}
              </span>
              <span className="pl-6 text-sm leading-5 text-muted-foreground">{choice.detail}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="gemini-key">Gemini API key</Label>
          <Input
            id="gemini-key"
            type="password"
            autoComplete="off"
            className="h-11"
            placeholder={serverGemini ? "Server key is already in use" : "Paste a key from Google AI Studio"}
            value={settings.geminiKey}
            onChange={(event) => onChange({ ...settings, geminiKey: event.target.value })}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Create one at{" "}
            <a
              className="underline underline-offset-4"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio
            </a>
            . It is sent only to this site, which forwards the photo to Gemini. BC Reader does not store the key on the
            server.
          </p>
        </div>

        <Button
          type="button"
          variant="destructive"
          className="h-10"
          disabled={bookCount === 0}
          onClick={onEmptyBook}
        >
          Empty the book
        </Button>
      </DialogContent>
    </Dialog>
  );
}
