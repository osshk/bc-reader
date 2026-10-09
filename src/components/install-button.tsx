"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function InstallButton() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    setIos(isIos());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = () => setInstalled(isInstalled());
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mq.addEventListener?.("change", onMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMode);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  const onClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    setHint((v) => !v);
  };

  return (
    <div className="relative">
      <Button type="button" className="h-10" onClick={onClick} data-testid="install-button">
        <Download />
        Install
      </Button>
      {hint && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border bg-background p-3 text-sm shadow-lg">
          Tap the Share button in Safari, then choose Add to Home Screen.
        </div>
      )}
    </div>
  );
}
