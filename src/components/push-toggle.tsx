"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { isIOS, standalone, subscribeThisDevice } from "@/lib/push-client";
import { toastError } from "@/lib/toast-error";

// icons: notifications_off ios_share
type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "unconfigured";

/** "Notify this device": registers the service worker, asks permission, stores the subscription. One row on the Inbox page. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!publicKey) return setState("unconfigured");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(isIOS() && !standalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  const enable = () => start(async () => {
    try {
      const perm = await subscribeThisDevice(publicKey!);
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      setState("on"); toast.success("Notifications are on for this device");
    } catch (e) { toastError(e); }
  });
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
  // Nothing to do, nothing to say: no card while checking, when push isn't available, or once it is on.
  if (state === "checking" || state === "unconfigured" || state === "unsupported") return null;
  if (state === "on") return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-subtle p-5 md:flex-row md:items-center md:gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card"><Icon name={state === "ios-install" ? "ios_share" : "notifications_off"} size={20} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{c.title}</p><p className="text-sm text-muted-foreground">{c.hint}</p></div>
      <div className="flex gap-2">
        {state === "off" && <Button type="button" size="lg" disabled={pending} onClick={enable}>Turn on</Button>}
      </div>
    </div>
  );
}
