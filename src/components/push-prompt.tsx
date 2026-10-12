"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { pushSupported, standalone, subscribeThisDevice } from "@/lib/push-client";
import { errorMessage } from "@/lib/user-error";

// icons: notifications_active
const KEY = "dc.pushPrompt";
const COOLDOWN_DAYS = 14;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

/**
 * First-run ask inside the installed app: "Turn on notifications?". Browsers (iOS especially) only allow the
 * permission dialog from a tap, so this is a small card with a Turn on button rather than an automatic pop-up.
 * Shown once the person is signed in and the app is running from the Home Screen, only if they have not decided yet.
 * "Not now" hides it for two weeks; the Inbox keeps a switch for later.
 */
export function PushPrompt() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!publicKey || !standalone() || !pushSupported() || Notification.permission !== "default") return;
    const seen = read();
    if (seen === "denied") return;
    if (seen && Date.now() - Number(seen) < COOLDOWN_DAYS * 86400_000) return;
    let alive = true;
    (async () => {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      if (existing || !alive) return;
      setTimeout(() => { if (alive) setShow(true); }, 1500);
    })().catch(() => {});
    return () => { alive = false; };
  }, [publicKey]);

  if (!show) return null;
  const later = () => { write(String(Date.now())); setShow(false); };
  const turnOn = () => start(async () => {
    try {
      const perm = await subscribeThisDevice(publicKey);
      if (perm === "granted") toast.success("Notifications are on for this device");
      else if (perm === "denied") write("denied");
      else write(String(Date.now()));
      setShow(false);
    } catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <div role="dialog" aria-label="Turn on notifications" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+90px)] z-50 rounded-2xl bg-inverse-surface p-4 text-inverse-on-surface shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"><Icon name="notifications_active" size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Get notified when it matters</p>
          <p className="mt-0.5 text-sm text-inverse-on-surface/75">Mentions, approvals, assignments and due dates, even when the app is closed. You can change this any time in your Inbox.</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" className="text-inverse-on-surface hover:bg-white/10 hover:text-inverse-on-surface" onClick={later} disabled={pending}>Not now</Button>
        <Button type="button" className="bg-inverse-on-surface text-inverse-surface hover:bg-inverse-on-surface/90" onClick={turnOn} disabled={pending}>{pending ? "Turning on…" : "Turn on"}</Button>
      </div>
    </div>
  );
}
