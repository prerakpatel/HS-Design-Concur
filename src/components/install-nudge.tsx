"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { isIOS, standalone } from "@/lib/push-client";

// icons: ios_share close
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
const KEY = "dc.installNudge";
const COOLDOWN_DAYS = 30;
const DELAY_MS = 7000;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

/**
 * A quiet card, a few seconds after the app opens in a browser, saying it can be added as an app. Chrome and Edge
 * (Android and desktop) can install with one tap, so the card carries an Install button. iPhone and iPad cannot be
 * asked programmatically, so the card says where to tap. Nothing blocks the page and "Not now" hides it for a month.
 * Never shown inside the installed app.
 */
export function InstallNudge() {
  const [mode, setMode] = useState<"install" | "ios-safari" | "ios-other" | null>(null);
  const [show, setShow] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    if (standalone()) return;
    const seen = read();
    if (seen === "installed") return;
    if (seen && Date.now() - Number(seen) < COOLDOWN_DAYS * 86400_000) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reveal = (m: "install" | "ios-safari" | "ios-other") => { if (!timer) timer = setTimeout(() => { setMode(m); setShow(true); }, DELAY_MS); };
    const onPrompt = (e: Event) => { e.preventDefault(); deferred.current = e as InstallEvent; reveal("install"); };
    const onInstalled = () => { write("installed"); setShow(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIOS()) reveal(/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent) ? "ios-other" : "ios-safari");
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!show || !mode) return null;
  const later = () => { write(String(Date.now())); setShow(false); };
  const install = async () => {
    const e = deferred.current; if (!e) return later();
    try { await e.prompt(); const { outcome } = await e.userChoice; write(outcome === "accepted" ? "installed" : String(Date.now())); } catch { write(String(Date.now())); }
    setShow(false);
  };
  // iOS can't install programmatically, but the Web Share API opens the system share sheet, where "Add to Home
  // Screen" is one row away. Needs a user gesture, so it hangs off the tap. Cancelling rejects with AbortError.
  const canShare = mode !== "install" && typeof navigator !== "undefined" && typeof navigator.share === "function";
  const openShare = async () => {
    try { await navigator.share({ title: "Design & Concur", url: window.location.origin }); } catch { /* cancelled or unsupported */ }
  };
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  return (
    <div role="region" aria-label="Add Design & Concur as an app" className="animate-nudge fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 overflow-hidden rounded-2xl border border-brand/30 bg-brand-soft shadow-[0_6px_20px_-6px_rgb(0_0_0/0.18)] md:inset-x-auto md:bottom-6 md:right-6 md:w-[22rem]">
      {/* Slow drifting colour behind the card. Solid brand-soft base so it lifts off the page; blobs sit in the
          corners and stay saturated, leaving the text zone light for contrast. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="aurora-a absolute -left-8 -top-14 size-44 rounded-full bg-brand/60 blur-2xl" />
        <span className="aurora-b absolute -bottom-16 -right-6 size-48 rounded-full bg-warning/55 blur-2xl" />
        <span className="aurora-c absolute -bottom-10 left-1/4 size-32 rounded-full bg-info/25 blur-2xl" />
      </div>
      <div className="relative p-4">
        <button type="button" onClick={later} aria-label="Dismiss" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-brand-foreground/70 hover:bg-brand-foreground/10"><Icon name="close" className="!text-[18px]" /></button>
        <div className={`pr-8 ${canShare ? "cursor-pointer" : ""}`} onClick={canShare ? openShare : undefined}>
          <p className="text-[15px] font-semibold text-brand-foreground">{mode === "install" && !phone ? "Install as an app" : "Add to your home screen"}</p>
          <p className="mt-0.5 text-sm text-brand-foreground/80">
            {mode === "ios-safari" && <>Tap <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> Share, then Add to Home Screen.</>}
            {mode === "ios-other" && <>Tap the <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> share icon, then Add to Home Screen.</>}
            {mode === "install" && (phone ? "Open it like an app." : "Open it in its own window.")}
          </p>
        </div>
        {mode === "install" && <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={later}>Not now</Button><Button type="button" onClick={install}>{phone ? "Add" : "Install"}</Button></div>}
        {canShare && <div className="mt-3 flex justify-end"><Button type="button" onClick={openShare}><Icon name="ios_share" className="!text-[18px]" />Open Share</Button></div>}
      </div>
    </div>
  );
}
