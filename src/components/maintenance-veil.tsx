"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { setMaintenance } from "@/app/actions/admin";
import { toastError } from "@/lib/toast-error";
import type { MaintenanceState } from "@/lib/maintenance";

// icons: construction
export const DEFAULT_HOLD_MESSAGE = "We’re making a quick improvement and should be back in a moment.";
const POLL_MS = 60_000;

/**
 * The maintenance hold. Sits on top of the app without unmounting it, so anything someone was typing stays put
 * and is there again when the hold lifts. Pages poll /api/status (and re-check when the tab regains focus), so the
 * veil appears and disappears on its own. Everyone is held, Core Admins included; they get a "Turn off the hold" button on the screen.
 */
export function MaintenanceVeil({ initial }: { initial: MaintenanceState }) {
  const [state, setState] = useState(initial);
  const router = useRouter();
  const wasOn = useRef(initial.on);
  const [busy, setBusy] = useState(false);
  const blocked = state.on;

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const next = (await r.json()) as MaintenanceState;
        setState(next);
        const nowBlocked = next.on;
        if (wasOn.current && !nowBlocked) { toast.success("We’re back. Thanks for waiting."); router.refresh(); }
        wasOn.current = nowBlocked;
      } catch { /* offline or mid-deploy: keep whatever is showing */ }
    };
    const id = setInterval(() => { if (document.visibilityState === "visible") void check(); }, POLL_MS); // a hidden tab does not need to keep asking
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible); window.addEventListener("focus", check);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", check); };
  }, [router]);

  // While the veil is up, nothing behind it can take focus or be clicked through assistive tech.
  useEffect(() => {
    if (!blocked) return;
    const others = [...document.body.children].filter((el) => !el.hasAttribute("data-veil")) as HTMLElement[];
    others.forEach((el) => el.setAttribute("inert", ""));
    return () => others.forEach((el) => el.removeAttribute("inert"));
  }, [blocked]);

  const release = async () => {
    setBusy(true);
    try { await setMaintenance(false, ""); setState((st) => ({ ...st, on: false })); wasOn.current = false; toast.success("Hold is off. Everyone is back in."); router.refresh(); }
    catch (e) { toastError(e); }
    setBusy(false);
  };
  if (!blocked) return null;
  return (
    <div data-veil role="alertdialog" aria-modal="true" aria-labelledby="hold-title" aria-describedby="hold-text" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-6 backdrop-blur-md">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-info-soft text-info-text"><Icon name="construction" className="!text-[32px]" /></span>
        <h2 id="hold-title" className="mt-6 text-2xl font-semibold tracking-[-0.02em]">Please hold</h2>
        <p id="hold-text" className="mt-2 text-base text-muted-foreground">{state.message?.trim() || DEFAULT_HOLD_MESSAGE}</p>
        <p className="mt-6 text-sm text-muted-foreground">Your work is safe. This screen goes away by itself, no need to refresh.</p>
        {state.admin && <Button className="mt-6" onClick={release} disabled={busy}>{busy ? "Turning off…" : "Turn off the hold"}</Button>}
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="size-2 animate-pulse rounded-full bg-info" style={{ animationDelay: `${i * 200}ms` }} />)}</div>
      </div>
    </div>
  );
}
