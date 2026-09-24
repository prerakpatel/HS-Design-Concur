import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { sendEmail, appUrl } from "@/lib/email";
import { postChat, chat, mention, platformOf, type ChatUser } from "@/lib/chat";
import { sendPush } from "@/lib/push";
import { notificationText, notificationHref, chatLines } from "@/lib/labels";

export type NotificationKind =
  | "access.requested" | "access.approved" | "slot.assigned" | "slot.due" | "comment.mention" | "comment.posted"
  | "version.uploaded" | "version.changes_requested" | "version.approved" | "versions.approved" | "version.reopened"
  | "event.all_approved" | "event.deleted" | "event.published" | "event.archived"
  | "draft.expiring" | "draft.swept" | "devices.refresh";

/**
 * How each kind reaches the org's Google Chat space / Slack channel (PRD §10). Every post goes to the channel;
 * "mention" kinds also @-mention the people it is for (the recipients, unless the caller narrows them with
 * `opts.mention`). Kinds not listed stay in-app / push only.
 */
const CHAT: Partial<Record<NotificationKind, "mention" | "channel">> = {
  "access.requested": "mention", "access.approved": "mention", "slot.assigned": "mention", "slot.due": "mention",
  "comment.mention": "mention", "comment.posted": "mention", "version.uploaded": "mention",
  "version.changes_requested": "mention", "version.approved": "channel", "versions.approved": "mention", "version.reopened": "mention",
  "event.all_approved": "mention", "event.published": "mention", "event.archived": "channel",
};

const SUBJECT: Record<NotificationKind, (p: Record<string, unknown>) => string> = {
  "access.requested": (p) => `Access request: ${p.name ?? p.email}`,
  "access.approved": () => "You're in: Design & Concur",
  "slot.assigned": (p) => `Assigned: ${p.format} for ${p.title}`,
  "slot.due": (p) => `${p.when === "today" ? "Due today" : "Due in 3 days"}: ${p.format} for ${p.title}`,
  "comment.mention": (p) => `${p.by} mentioned you on ${p.format}`,
  "comment.posted": (p) => `${p.by} commented on ${p.format} · ${p.title}`,
  "version.uploaded": (p) => `Ready for review: ${p.format} v${p.number} · ${p.title}`,
  "version.changes_requested": (p) => `Changes requested: ${p.format} v${p.number} · ${p.title}`,
  "version.approved": (p) => `Approved: ${p.format} v${p.number} · ${p.title}`,
  "versions.approved": (p) => `Approved: ${p.count} designs · ${p.title}`,
  "version.reopened": (p) => `Reopened: ${p.format} v${p.number} · ${p.title}`,
  "event.all_approved": (p) => `All approved: ${p.title}`,
  "event.deleted": (p) => `Deleted: ${p.title}`,
  "event.published": (p) => `New event: ${p.title}`,
  "event.archived": (p) => `Archived: ${p.title}`,
  "draft.expiring": (p) => `Draft “${p.title}” is deleted in ${p.days} days`,
  "draft.swept": (p) => `Draft “${p.title}” was deleted`,
  "devices.refresh": (p) => `Yearly check: phone preview presets for ${p.year}`,
};

/** Email subject line for a notification kind. */
export function subjectFor(kind: NotificationKind, payload: Record<string, unknown>) { return (SUBJECT[kind] ?? (() => "Design & Concur"))(payload); }

export interface NotifyOpts {
  /** Org(s) whose chat webhooks receive the post; "all" for org-less moments such as access requests. */
  orgId?: string | string[] | "all";
  /** People to @-mention in chat instead of every recipient (e.g. only the designer on an approval). */
  mention?: Iterable<string | null | undefined>;
}

/**
 * Create in-app notifications and deliver them: a push to every device the person turned on, instant email to
 * users who want it (org email switch permitting), and, for chat kinds with an `orgId`, one post per Google Chat
 * space / Slack channel with the people it concerns @-mentioned. Delivery runs after the response is sent, so
 * server actions stay fast.
 */
export async function notify(supabase: SupabaseClient, userIds: Iterable<string | null | undefined>, kind: NotificationKind, payload: Record<string, unknown>, exclude?: string, opts?: NotifyOpts) {
  const ids = [...new Set(userIds)].filter((id): id is string => !!id && id !== exclude);
  const toChat = !!opts?.orgId && kind in CHAT;
  if (ids.length === 0 && !toChat) return;
  if (ids.length) await supabase.from("notifications").insert(ids.map((user_id) => ({ user_id, kind, payload })));
  const mentions = toChat ? [...new Set(opts?.mention ? [...opts.mention] : CHAT[kind] === "mention" ? ids : [])].filter((id): id is string => !!id && id !== exclude) : [];
  after(() => deliver(supabase, ids, kind, payload, opts?.orgId, mentions));
}

interface OrgRow { id: string; email_enabled: boolean | null; chat_enabled: boolean; chat_webhook_url: string | null; slack_enabled: boolean; slack_webhook_url: string | null }

async function deliver(supabase: SupabaseClient, ids: string[], kind: NotificationKind, payload: Record<string, unknown>, orgId: NotifyOpts["orgId"], mentions: string[]) {
  let orgs: OrgRow[] = [];
  if (orgId) {
    let q = supabase.from("organisations").select("id,email_enabled,chat_enabled,chat_webhook_url,slack_enabled,slack_webhook_url");
    if (orgId !== "all") q = q.in("id", Array.isArray(orgId) ? orgId : [orgId]);
    orgs = ((await q).data as OrgRow[] | null) ?? [];
  }
  const text = notificationText(kind, payload);
  const href = appUrl(notificationHref(payload));

  if (ids.length) { try { await sendPush(ids, { title: SUBJECT[kind](payload), body: text, href, tag: `${kind}:${payload.slotId ?? payload.eventId ?? ""}` }); } catch (e) { console.error("[push]", (e as Error).message); } }

  if (ids.length && orgs.every((o) => o.email_enabled ?? true)) {
    const { data: users } = await supabase.from("users").select("id,email,name,email_pref").in("id", ids).eq("status", "active").eq("email_pref", "instant");
    const results = await Promise.allSettled((users ?? []).map((u) =>
      sendEmail(u.email, SUBJECT[kind](payload), { heading: text, body: payload.excerpt ? `“${payload.excerpt}”` : `${payload.title ?? ""}`.trim() || " ", cta: { label: "Open in Design & Concur", href } })));
    const sent = (users ?? []).filter((_, i) => results[i].status === "fulfilled" && "ok" in (results[i] as PromiseFulfilledResult<{ ok?: true }>).value).map((u) => u.id);
    if (sent.length) await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).in("user_id", sent).eq("kind", kind).is("emailed_at", null).gte("created_at", new Date(Date.now() - 60_000).toISOString());
    for (const r of results) if (r.status === "fulfilled" && "error" in r.value) console.error("[email]", r.value.error);
  }

  if (orgId && kind in CHAT) {
    // One post per distinct webhook, so two orgs sharing a channel do not double up.
    const hooks = [...new Set(orgs.flatMap((o) => [o.chat_enabled && o.chat_webhook_url, o.slack_enabled && o.slack_webhook_url]).filter((h): h is string => !!h))];
    if (hooks.length === 0) return;
    const { head, body } = chatLines(kind, payload);
    const placeholderIds = [...body.matchAll(/\{@([0-9a-f-]{36})\}/g)].map((m) => m[1]);
    const wanted = [...new Set([...mentions, ...placeholderIds])];
    const people = new Map<string, ChatUser>();
    if (wanted.length) for (const u of ((await supabase.from("users").select("id,name,email,slack_user_id,gchat_user_id").in("id", wanted)).data as ChatUser[] | null) ?? []) people.set(u.id, u);
    const results = await Promise.all(hooks.map((hook) => {
      const platform = platformOf(hook);
      const at = (id: string) => { const u = people.get(id); return u ? mention(u, platform) : ""; };
      const bodyText = body.replace(/\{@([0-9a-f-]{36})\}/g, (_, id) => at(id) || "someone");
      const who = mentions.filter((id) => !placeholderIds.includes(id)).map(at).filter(Boolean).join(" ");
      return postChat(hook, [chat.bold(head), bodyText, who, chat.link(href, "Open in Design & Concur")].filter(Boolean).join("\n"));
    }));
    for (const r of results) if ("error" in r) console.error("[chat]", r.error);
  }
}

/** Everyone "on the event" (PRD §6.2) via the event_participants() SQL helper. */
export async function eventParticipants(supabase: SupabaseClient, eventId: string): Promise<string[]> {
  const { data } = await supabase.rpc("event_participants", { p_event: eventId });
  return (data as { event_participants: string }[] | string[] | null)?.map((r) => (typeof r === "string" ? r : r.event_participants)) ?? [];
}

/** Active Core Admins, for org-less moments such as a new access request. */
export async function coreAdminIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("users").select("id").eq("status", "active").eq("role", "core_admin");
  return (data ?? []).map((u) => u.id as string);
}

/** Active members of an org carrying a function tag (e.g. "publication"). */
export async function taggedMemberIds(supabase: SupabaseClient, orgId: string, tag: string): Promise<string[]> {
  const { data } = await supabase.from("users").select("id,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", orgId).contains("function_tags", [tag]);
  return (data ?? []).map((u) => u.id as string);
}
