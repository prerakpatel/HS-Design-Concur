"use client";
import { Button } from "@/components/ui/button";

/** The last safety net: a page that fails to load shows this instead of a blank screen, with a way to try again. */
export default function ErrorPage({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">That page could not load. Nothing was lost. Try again, and if it keeps happening, tell the person who runs Design &amp; Concur.</p>
      <Button size="lg" onClick={() => unstable_retry()}>Try again</Button>
    </div>
  );
}
