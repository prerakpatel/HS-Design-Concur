"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { isIOS, standalone } from "@/lib/push-client";

// icons: ios_share install_mobile install_desktop close
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
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  return (
    <div role="region" aria-label="Add Design & Concur as an app" className="animate-nudge fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 rounded-2xl border border-border bg-card p-4 shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-[22rem]">
      <button type="button" onClick={later} aria-label="Dismiss" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><Icon name="close" className="!text-[18px]" /></button>
      <div className="flex items-start gap-3 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-foreground"><Icon name={phone ? "install_mobile" : "install_desktop"} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{phone ? "Add this to your home screen" : "Install Design & Concur"}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {mode === "ios-safari" && <>Tap <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> Share, then <span className="font-medium text-foreground">Add to Home Screen</span>. It opens like an app and can notify you.</>}
            {mode === "ios-other" && <>Tap the <Icon name="ios_share" className="!text-[16px] align-[-3px]" /> share icon, then <span className="font-medium text-foreground">Add to Home Screen</span>. It opens like an app and can notify you.</>}
            {mode === "install" && (phone ? "Use it like an app: one tap to open, and it can notify you when something needs you." : "Open it in its own window, one click from your dock or taskbar, and get notified when something needs you.")}
          </p>
        </div>
      </div>
      {mode === "install" && <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={later}>Not now</Button><Button type="button" onClick={install}>{phone ? "Add to home screen" : "Install"}</Button></div>}
    </div>
  );
}
