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

function iosOtherBrowser() {
  return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent);
}

export function InstallButton() {
  const [other, setOther] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    setIos(isIos());
    setOther(isIos() && iosOtherBrowser());
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

  const openInSafari = () => {
    // iOS 17+: x-safari-https opens the page in Safari. Undocumented by Apple.
    window.location.href = "x-safari-" + window.location.href;
    window.setTimeout(() => setCopied(false), 0);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/");
      setCopied(true);
    } catch {
      window.prompt("Copy this link, then open Safari and paste it:", window.location.origin + "/");
    }
  };

  return (
    <div className="relative">
      <Button type="button" className="h-10" onClick={onClick} data-testid="install-button">
        <Download />
        Install
      </Button>
      {hint && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border bg-background p-3 text-sm shadow-lg" data-testid="install-hint">
          {other ? (
            <div className="space-y-2">
              <p className="font-medium">Install works best in Safari.</p>
              <Button type="button" className="h-10 w-full" onClick={openInSafari} data-testid="open-safari">
                Open in Safari
              </Button>
              <Button type="button" variant="outline" className="h-10 w-full" onClick={copyLink}>
                {copied ? "Link copied. Paste it in Safari." : "Copy link for Safari"}
              </Button>
            </div>
          ) : (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Tap the Share button (square with an up arrow) at the bottom of Safari.</li>
              <li>Scroll down and tap Add to Home Screen.</li>
              <li>Tap Add.</li>
            </ol>
          )}
        </div>
      )}
      {hint && !other && (
        <div className="pointer-events-none fixed bottom-2 left-1/2 z-50 -translate-x-1/2 animate-bounce text-3xl" aria-hidden>
          ↓
        </div>
      )}
    </div>
  );
}
