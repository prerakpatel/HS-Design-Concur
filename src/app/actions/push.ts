"use server";
import { requireActiveUser } from "@/lib/auth";
import { headers } from "next/headers";

export interface PushSubscriptionJSONish { endpoint: string; keys: { p256dh: string; auth: string } }

/** Remember this browser's push subscription for the signed-in person. Same endpoint from a new login moves it over. */
export async function savePushSubscription(sub: PushSubscriptionJSONish) {
  const { supabase, user } = await requireActiveUser();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("That browser did not return a usable subscription");
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: ua }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
}

export async function removePushSubscription(endpoint: string) {
  const { supabase, user } = await requireActiveUser();
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
}

export async function sendTestPush() {
  const { user } = await requireActiveUser();
  const { sendPush, pushConfigured } = await import("@/lib/push");
  if (!pushConfigured()) throw new Error("Push is not set up on the server yet (VAPID keys)");
  const r = await sendPush([user.id], { title: "Design & Concur", body: "Notifications are on for this device.", href: "/inbox", tag: "test" });
  if (r.sent === 0) throw new Error("No device is subscribed. Turn notifications on first.");
}
