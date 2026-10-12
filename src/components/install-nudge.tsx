"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/material-icon";
import { isIOS, standalone } from "@/lib/push-client";

// icons: ios_share close install_mobile install_desktop
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
const KEY = "dc.installNudge";
const COUNT_KEY = "dc.installNudge.dismissals";
const COOLDOWN_DAYS = 7;
const MAX_DISMISSALS = 2; // shown, dismissed, shown once more after the cooldown, dismissed again: then never again
const DELAY_MS = 7000;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };
// A timestamp saved before the counter existed means one earlier dismissal.
const dismissals = () => { try { const n = Number(localStorage.getItem(COUNT_KEY)); return n > 0 ? n : read() ? 1 : 0; } catch { return 0; } };
const dismiss = () => { const n = dismissals() + 1; write(String(Date.now())); try { localStorage.setItem(COUNT_KEY, String(n)); } catch { /* private mode */ } };

/**
 * A quiet card (top right on desktop, next to the browser's install icon; above the tab bar on phones), a few seconds after the app opens in a browser, saying it can be added as an app. Chrome and Edge
 * (Android and desktop) can install with one tap, so tapping the card installs. iPhone and iPad cannot be
 * asked programmatically, so the card says where to tap. On Chrome/Edge the whole card is the tap target; the close button hides it for a week; after a second dismissal it stays away.
 * Never shown inside the installed app.
 */
export function InstallNudge() {
  const [mode, setMode] = useState<"install" | "ios-safari" | "ios-other" | null>(null);
  const [show, setShow] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    // ?nudge=1 shows the card straight away for a look, ignoring "already dismissed".
    const force = new URLSearchParams(window.location.search).get("nudge") === "1";
    if (standalone()) return;
    const seen = force ? null : read();
    if (seen === "installed") return;
    if (seen && !force && dismissals() >= MAX_DISMISSALS) return;
    if (seen && Date.now() - Number(seen) < COOLDOWN_DAYS * 86400_000) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reveal = (m: "install" | "ios-safari" | "ios-other") => { if (!timer) timer = setTimeout(() => { setMode(m); setShow(true); }, force ? 600 : DELAY_MS); };
    const onPrompt = (e: Event) => { e.preventDefault(); deferred.current = e as InstallEvent; reveal("install"); };
    const onInstalled = () => { write("installed"); setShow(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (force && !isIOS()) reveal("install");
    if (isIOS()) reveal(/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent) ? "ios-other" : "ios-safari");
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!show || !mode) return null;
  const later = () => { dismiss(); setShow(false); };
  const install = async () => {
    const e = deferred.current; if (!e) return later();
    try { await e.prompt(); const { outcome } = await e.userChoice; if (outcome === "accepted") write("installed"); else dismiss(); } catch { dismiss(); }
    setShow(false);
  };
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const tappable = mode === "install";
  const body = (
    <>
      <p className="text-[15px] font-semibold leading-5">{mode === "install" && !phone ? "Install as an app" : "Add to your home screen"}</p>
      <p className="mt-0.5 text-sm text-inverse-on-surface/75">
        {mode === "ios-safari" && <>Tap <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> Share in the toolbar, then Add to Home Screen.</>}
        {mode === "ios-other" && <>Open the browser menu, tap <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> Share, then Add to Home Screen.</>}
        {mode === "install" && (phone ? "Tap to open it like an app." : "Click to open it in its own window.")}
      </p>
    </>
  );
  return (
    <div className="animate-nudge fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),12px)+86px)] z-40 md:inset-x-auto md:bottom-auto md:right-6 md:top-4 md:w-[24rem]">
      <div role="region" aria-label="Add Design & Concur as an app" className="relative overflow-hidden rounded-3xl bg-inverse-surface p-4 text-inverse-on-surface shadow-[0_18px_50px_-12px_rgba(0,0,0,0.5)]">
        <button type="button" onClick={later} aria-label="Dismiss" className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full bg-white/10 text-inverse-on-surface/75 hover:bg-white/20"><Icon name="close" className="!text-[16px]" /></button>
        {/* Tapping the card installs on Chrome/Edge. On iPhone it is instructions only: navigator.share() opens the content
            share sheet, which never offers "Add to Home Screen" (only the browser's own Share does). */}
        <div role={tappable ? "button" : undefined} tabIndex={tappable ? 0 : undefined} onClick={tappable ? install : undefined} onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void install(); } } : undefined} className={"relative flex items-start gap-3.5 pr-8 " + (tappable ? "cursor-pointer" : "")}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm"><Icon name={phone ? "install_mobile" : "install_desktop"} size={24} /></span>
          <div className="min-w-0 flex-1">{body}</div>
        </div>
        {mode === "install" && <div className="relative mt-3 flex items-center justify-end gap-2"><button type="button" onClick={later} className="h-9 rounded-full px-4 text-sm font-medium text-inverse-on-surface/80 hover:bg-white/10">Not now</button><button type="button" onClick={install} className="h-9 rounded-full bg-inverse-on-surface px-5 text-sm font-semibold text-inverse-surface shadow-sm hover:bg-inverse-on-surface/90">{phone ? "Add" : "Install"}</button></div>}
      </div>
    </div>
  );
}
