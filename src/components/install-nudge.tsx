"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/material-icon";
import { isIOS, standalone } from "@/lib/push-client";

// icons: ios_share close install_mobile install_desktop
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
const KEY = "dc.installNudge";
const COOLDOWN_DAYS = 30;
const DELAY_MS = 7000;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

/**
 * A quiet card, a few seconds after the app opens in a browser, saying it can be added as an app. Chrome and Edge
 * (Android and desktop) can install with one tap, so tapping the card installs. iPhone and iPad cannot be
 * asked programmatically, so the card says where to tap. The whole card is the tap target; the close button hides it for a month.
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
  const tappable = mode === "install" || canShare;
  const body = (
    <>
      <p className="text-[15px] font-semibold leading-5">{mode === "install" && !phone ? "Install as an app" : "Add to your home screen"}</p>
      <p className="mt-0.5 text-sm text-foreground/65">
        {mode === "ios-safari" && <>Tap <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> Share, then Add to Home Screen.</>}
        {mode === "ios-other" && <>Tap the <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> share icon, then Add to Home Screen.</>}
        {mode === "install" && (phone ? "Tap to open it like an app." : "Click to open it in its own window.")}
      </p>
    </>
  );
  return (
    <div className="animate-nudge fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] z-40 md:inset-x-auto md:bottom-6 md:right-6 md:w-[24rem]">
      <div role="region" aria-label="Add Design & Concur as an app" className="relative overflow-hidden rounded-3xl border-2 border-brand/35 bg-white/60 p-4 text-foreground shadow-[0_18px_50px_-12px_rgba(20,30,60,0.35)] backdrop-blur-2xl">
        {/* Big soft pastel-orange light drifting through the frost. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="aurora-a absolute -left-12 -top-16 size-64 rounded-full bg-brand/40 blur-3xl" />
          <span className="aurora-b absolute -bottom-20 -right-10 size-72 rounded-full bg-warning/35 blur-3xl" />
          <span className="aurora-c absolute left-1/4 top-0 size-56 rounded-full bg-brand/30 blur-3xl" />
        </div>
        <button type="button" onClick={later} aria-label="Dismiss" className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full bg-black/5 text-foreground/60 hover:bg-black/10"><Icon name="close" className="!text-[16px]" /></button>
        {/* Tapping the card does the useful thing: install on Chrome/Edge, open the share sheet on iPhone. */}
        <div role={tappable ? "button" : undefined} tabIndex={tappable ? 0 : undefined} onClick={tappable ? (mode === "install" ? install : openShare) : undefined} onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void (mode === "install" ? install() : openShare()); } } : undefined} className={"relative flex items-start gap-3.5 pr-8 " + (tappable ? "cursor-pointer" : "")}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm"><Icon name={phone ? "install_mobile" : "install_desktop"} size={24} /></span>
          <div className="min-w-0 flex-1">{body}</div>
        </div>
        {mode === "install" && <div className="relative mt-3 flex items-center justify-end gap-2"><button type="button" onClick={later} className="h-9 rounded-full px-4 text-sm font-medium text-foreground/65 hover:bg-black/5">Not now</button><button type="button" onClick={install} className="h-9 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90">{phone ? "Add" : "Install"}</button></div>}
      </div>
    </div>
  );
}
