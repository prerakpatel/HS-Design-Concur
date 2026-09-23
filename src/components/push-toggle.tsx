"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { savePushSubscription, removePushSubscription, sendTestPush } from "@/app/actions/push";

// icons: notifications_active notifications_off ios_share
type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "unconfigured";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** "Notify this device": registers the service worker, asks permission, stores the subscription. One row on the Inbox page. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!publicKey) return setState("unconfigured");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(isIOS() && !standalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null); setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  const enable = () => start(async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription({ endpoint: json.endpoint, keys: json.keys });
      setEndpoint(json.endpoint); setState("on"); toast.success("Notifications are on for this device");
    } catch (e) { toast.error((e as Error).message); }
  });
  const disable = () => start(async () => {
    try {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (sub) { await sub.unsubscribe(); await removePushSubscription(sub.endpoint); }
      else if (endpoint) await removePushSubscription(endpoint);
      setEndpoint(null); setState("off"); toast.success("Notifications are off for this device");
    } catch (e) { toast.error((e as Error).message); }
  });
  const test = () => start(async () => { try { await sendTestPush(); toast.success("Sent. It should appear in a moment."); } catch (e) { toast.error((e as Error).message); } });

  const copy: Record<State, { title: string; hint: string }> = {
    checking: { title: "Notify this device", hint: "Checking…" },
    unconfigured: { title: "Notify this device", hint: "Push notifications are not set up on the server yet." },
    unsupported: { title: "Notify this device", hint: "This browser does not support push notifications." },
    "ios-install": { title: "Notify this iPhone", hint: "Add Design & Concur to your Home Screen first (Share → Add to Home Screen), then open it from there and turn this on." },
    denied: { title: "Notify this device", hint: "Notifications are blocked for this site in your browser settings. Allow them there, then reload." },
    off: { title: "Notify this device", hint: "Approvals, mentions, assignments and due dates, even when the app is closed." },
    on: { title: "Notifying this device", hint: "Approvals, mentions, assignments and due dates arrive here as they happen." },
  };
  const c = copy[state];
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-subtle p-5 md:flex-row md:items-center md:gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card"><Icon name={state === "on" ? "notifications_active" : state === "ios-install" ? "ios_share" : "notifications_off"} size={20} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{c.title}</p><p className="text-sm text-muted-foreground">{c.hint}</p></div>
      <div className="flex gap-2">
        {state === "on" && <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={test}>Send a test</Button>}
        {state === "on" && <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={disable}>Turn off</Button>}
        {state === "off" && <Button type="button" size="lg" disabled={pending} onClick={enable}>Turn on</Button>}
      </div>
    </div>
  );
}
