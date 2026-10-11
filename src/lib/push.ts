import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

export interface PushMessage { title: string; body: string; href: string; tag?: string }

/** Web Push is on when the VAPID pair is set (see docs/setup.md → Push notifications). */
export function pushConfigured() { return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY); }

/**
 * Send one notification to every device these people turned notifications on for. Dead subscriptions (the browser
 * revoked them, 404/410) are removed. Runs with the service role: subscriptions are private to each user under RLS.
 */
export async function sendPush(userIds: string[], msg: PushMessage) {
  if (!pushConfigured() || userIds.length === 0) return { sent: 0 };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://hsdesign.vercel.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const svc = createServiceClient();
  const { data: subs } = await svc.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", userIds);
  // The home-screen badge shows each person's own unread count (the new notification is already saved).
  const { data: unread } = await svc.from("notifications").select("user_id").in("user_id", userIds).is("read_at", null).limit(5000);
  const unreadOf = new Map<string, number>();
  for (const n of unread ?? []) unreadOf.set(n.user_id as string, (unreadOf.get(n.user_id as string) ?? 0) + 1);
  const gone: string[] = []; const ok: string[] = [];
  await Promise.allSettled((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, badge: unreadOf.get(s.user_id as string) ?? 0 }), { TTL: 60 * 60 * 6, urgency: "normal" });
      ok.push(s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.id); else console.error("[push]", code, (e as Error).message);
    }
  }));
  if (gone.length) await svc.from("push_subscriptions").delete().in("id", gone);
  if (ok.length) await svc.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", ok);
  return { sent: ok.length };
}
