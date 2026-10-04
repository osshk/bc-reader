"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">BC Reader</p>
      <h1 className="font-heading text-4xl tracking-tight">Something slipped.</h1>
      <p className="text-base leading-7 text-muted-foreground">
        The cards already filed in this browser are still saved. Try the plate again.
      </p>
      <Button type="button" className="h-11 w-fit" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
