import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { sendEmail, appUrl } from "@/lib/email";
import { postChat, chat } from "@/lib/chat";
import { notificationText, notificationHref, chatText } from "@/lib/labels";

export type NotificationKind =
  | "access.approved" | "slot.assigned" | "slot.due" | "comment.mention" | "version.uploaded"
  | "version.changes_requested" | "version.approved" | "version.reopened" | "event.deleted" | "event.published"
  | "draft.expiring" | "draft.swept" | "devices.refresh";

/** Kinds that are also announced in the org's Google Chat space (PRD §10). */
const CHAT_KINDS: NotificationKind[] = ["version.uploaded", "version.changes_requested", "version.approved", "version.reopened"];

const SUBJECT: Record<NotificationKind, (p: Record<string, unknown>) => string> = {
  "access.approved": () => "You're in: Design & Concur",
  "slot.assigned": (p) => `Assigned: ${p.format} for ${p.title}`,
  "slot.due": (p) => `${p.when === "today" ? "Due today" : "Due in 3 days"}: ${p.format} for ${p.title}`,
  "comment.mention": (p) => `${p.by} mentioned you on ${p.format}`,
  "version.uploaded": (p) => `Ready for review: ${p.format} v${p.number} · ${p.title}`,
  "version.changes_requested": (p) => `Changes requested: ${p.format} v${p.number} · ${p.title}`,
  "version.approved": (p) => `Approved: ${p.format} v${p.number} · ${p.title}`,
  "version.reopened": (p) => `Reopened: ${p.format} v${p.number} · ${p.title}`,
  "event.deleted": (p) => `Deleted: ${p.title}`,
  "event.published": (p) => `New event: ${p.title}`,
  "draft.expiring": (p) => `Draft “${p.title}” is deleted in ${p.days} days`,
  "draft.swept": (p) => `Draft “${p.title}” was deleted`,
  "devices.refresh": (p) => `Yearly check: phone preview presets for ${p.year}`,
};

/** Email subject line for a notification kind. */
export function subjectFor(kind: NotificationKind, payload: Record<string, unknown>) { return (SUBJECT[kind] ?? (() => "Design & Concur"))(payload); }

/**
 * Create in-app notifications and deliver them: instant email to users who want it (org email switch
 * permitting) and a Google Chat post for review-flow kinds when the org has a webhook. Delivery runs
 * after the response is sent, so server actions stay fast.
 */
export async function notify(supabase: SupabaseClient, userIds: Iterable<string>, kind: NotificationKind, payload: Record<string, unknown>, exclude?: string, opts?: { orgId?: string }) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exclude);
  if (ids.length === 0 && !(opts?.orgId && CHAT_KINDS.includes(kind))) return;
  if (ids.length) await supabase.from("notifications").insert(ids.map((user_id) => ({ user_id, kind, payload })));
  after(() => deliver(supabase, ids, kind, payload, opts?.orgId));
}

async function deliver(supabase: SupabaseClient, ids: string[], kind: NotificationKind, payload: Record<string, unknown>, orgId?: string) {
  const { data: org } = orgId ? await supabase.from("organisations").select("email_enabled,chat_enabled,chat_webhook_url,short_name").eq("id", orgId).maybeSingle() : { data: null };
  const text = notificationText(kind, payload);
  const href = appUrl(notificationHref(payload));

  if (ids.length && (org?.email_enabled ?? true)) {
    const { data: users } = await supabase.from("users").select("id,email,name,email_pref").in("id", ids).eq("status", "active").eq("email_pref", "instant");
    const results = await Promise.allSettled((users ?? []).map((u) =>
      sendEmail(u.email, SUBJECT[kind](payload), { heading: text, body: payload.excerpt ? `“${payload.excerpt}”` : `${payload.title ?? ""}`.trim() || " ", cta: { label: "Open in Design & Concur", href } })));
    const sent = (users ?? []).filter((_, i) => results[i].status === "fulfilled" && "ok" in (results[i] as PromiseFulfilledResult<{ ok?: true }>).value).map((u) => u.id);
    if (sent.length) await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).in("user_id", sent).eq("kind", kind).is("emailed_at", null).gte("created_at", new Date(Date.now() - 60_000).toISOString());
    for (const r of results) if (r.status === "fulfilled" && "error" in r.value) console.error("[email]", r.value.error);
  }

  if (org?.chat_enabled && org.chat_webhook_url && CHAT_KINDS.includes(kind)) {
    const r = await postChat(org.chat_webhook_url, `${chat.bold(chatText(kind, payload))}\n${chat.link(href, "Open in Design & Concur")}`);
    if ("error" in r) console.error("[chat]", r.error);
  }
}

/** Everyone "on the event" (PRD §6.2) via the event_participants() SQL helper. */
export async function eventParticipants(supabase: SupabaseClient, eventId: string): Promise<string[]> {
  const { data } = await supabase.rpc("event_participants", { p_event: eventId });
  return (data as { event_participants: string }[] | string[] | null)?.map((r) => (typeof r === "string" ? r : r.event_participants)) ?? [];
}
