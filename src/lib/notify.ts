import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { sendEmail, appUrl } from "@/lib/email";
import { postChat, chat, mention, platformOf, type ChatUser, type ChatImage } from "@/lib/chat";
import { signedUrl } from "@/lib/storage";
import { sendPush } from "@/lib/push";
import { notificationText, notificationHref, chatLines } from "@/lib/labels";
import { htmlToChat, mentionIds } from "@/lib/rich-text";
import { loadGroups } from "@/lib/groups";

export type NotificationKind =
  | "access.requested" | "access.approved" | "slot.assigned" | "slot.due" | "comment.mention" | "comment.posted" | "comments.posted" | "comments.unsent"
  | "version.uploaded" | "review.waiting" | "version.changes_requested" | "version.approved" | "versions.approved" | "version.reopened"
  | "event.all_approved" | "event.deleted" | "event.published" | "event.archived"
  | "draft.expiring" | "draft.swept" | "devices.refresh";

/**
 * How each kind reaches the org's Google Chat space / Slack channel (PRD §10). Every post goes to the channel;
 * "mention" kinds also @-mention the people it is for (the recipients, unless the caller narrows them with
 * `opts.mention`). Kinds not listed stay in-app / push only.
 */
const CHAT: Partial<Record<NotificationKind, "mention" | "channel">> = {
  // Access moments stay out of chat on purpose: they would show a newcomer's name and email to the whole channel.
  "slot.assigned": "mention", "slot.due": "mention",
  "comment.mention": "mention", "comment.posted": "mention", "comments.posted": "mention", "version.uploaded": "mention", "review.waiting": "mention",
  "version.changes_requested": "mention", "version.approved": "channel", "versions.approved": "mention", "version.reopened": "mention",
  "event.all_approved": "mention", "event.published": "mention", "event.archived": "channel",
};

/** Event-level moments every group hears about, whatever its setting. Archiving is housekeeping: org channel only. */
const MILESTONES = new Set<NotificationKind>(["event.published", "event.all_approved"]);

const SUBJECT: Record<NotificationKind, (p: Record<string, unknown>) => string> = {
  "access.requested": (p) => `Access request: ${p.name ?? p.email}`,
  "access.approved": () => "You're in: Design & Concur",
  "slot.assigned": (p) => `Assigned: ${p.format} for ${p.title}`,
  "slot.due": (p) => `${p.when === "today" ? "Due today" : "Due in 3 days"}: ${p.format} for ${p.title}`,
  "comment.mention": (p) => `${p.by} mentioned you on ${p.format}`,
  "comment.posted": (p) => `${p.by} commented on ${p.format} · ${p.title}`,
  "comments.posted": (p) => `${p.by} left ${p.count} comments on ${p.format} · ${p.title}`,
  "comments.unsent": (p) => `You have unsent comments on ${p.format} · ${p.title}`,
  "version.uploaded": (p) => `Ready for review: ${p.format} v${p.number} · ${p.title}`,
  "review.waiting": (p) => `Still waiting: ${p.format} v${p.number} · ${p.title}`,
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
    // Where does this post go? Groups route by the people concerned (PRD §10):
    //  - milestones (published, all approved, archived, bulk approvals) reach every group and the org channel;
    //  - a design post reaches groups set to "everything", groups set to "its own designs" that include someone
    //    concerned, any group @mentioned in the comment, and the org channel when someone concerned is in no group.
    const groups = await loadGroups(supabase, orgId === "all" ? "all" : Array.isArray(orgId) ? orgId : [orgId]);
    const milestone = MILESTONES.has(kind);
    const audience = new Set([...ids, ...mentions]);
    const grouped = new Set(groups.flatMap((g) => g.members));
    const explicit = new Set(Array.isArray(payload.groups) ? (payload.groups as string[]) : []);
    const someoneUngrouped = groups.length === 0 || [...audience].some((id) => !grouped.has(id));
    const hookList: string[] = [];
    if (milestone || someoneUngrouped || kind === "event.archived") hookList.push(...orgs.flatMap((o) => [o.chat_enabled && o.chat_webhook_url, o.slack_enabled && o.slack_webhook_url]).filter((h): h is string => !!h));
    for (const g of groups) {
      const touches = g.members.some((m) => audience.has(m));
      if (explicit.has(g.id) || g.hears === "all" || milestone || (g.hears === "own" && touches)) hookList.push(...[g.chat_webhook_url, g.slack_webhook_url].filter((h): h is string => !!h));
    }
    // One post per distinct webhook, so two groups sharing a channel do not double up.
    const hooks = [...new Set(hookList)];
    if (hooks.length === 0) return;
    const { head, body } = chatLines(kind, payload);
    const image = await previewImage(supabase, payload, head, href);
    const placeholderIds = [...body.matchAll(/\{@([0-9a-f-]{36})\}/g)].map((m) => m[1]);
    const excerptHtml = typeof payload.excerptHtml === "string" ? payload.excerptHtml : null;
    // A batch of comments carries each comment's HTML; they are listed as bullets in one post.
    const items = Array.isArray(payload.items) ? (payload.items as string[]) : [];
    const allHtml = excerptHtml ? [excerptHtml] : items;
    const wanted = [...new Set([...mentions, ...placeholderIds, ...allHtml.flatMap(mentionIds)])];
    const people = new Map<string, ChatUser>();
    if (wanted.length) for (const u of ((await supabase.from("users").select("id,name,email,slack_user_id,gchat_user_id").in("id", wanted)).data as ChatUser[] | null) ?? []) people.set(u.id, u);
    const results = await Promise.all(hooks.map((hook) => {
      const platform = platformOf(hook);
      const at = (id: string) => { const u = people.get(id); return u ? mention(u, platform) : ""; };
      // A formatted comment keeps its bold, italics, bullets, links and mentions in the platform's own markup.
      const render = (html: string) => htmlToChat(html, platform, (id, label) => at(id) || chat.bold(`@${label}`));
      const rendered = excerptHtml ? chatLines(kind, { ...payload, excerpt: render(excerptHtml) }).body
        : items.length ? chatLines(kind, { ...payload, excerpt: items.map((h) => `• ${render(h).replace(/\n/g, "\n   ")}`).join("\n") }).body : body;
      const bodyText = rendered.replace(/\{@([0-9a-f-]{36})\}/g, (_, id) => at(id) || "someone");
      const inlined = new Set([...placeholderIds, ...allHtml.flatMap(mentionIds)]);
      const who = mentions.filter((id) => !inlined.has(id)).map(at).filter(Boolean).join(" ");
      return postChat(hook, [chat.bold(head), bodyText, who, chat.link(href, "Open in Design & Concur")].filter(Boolean).join("\n"), image);
    }));
    for (const r of results) if ("error" in r) console.error("[chat]", r.error);
  }
}

/** Preview-image link for chat. The chat bucket is private, so a signed link that lasts as long as the post matters. */
const PREVIEW_LINK_DAYS = 7;

/**
 * The watermarked front preview of the version a post is about (thumb for GIFs, which have no preview), as a
 * signed URL both platforms can fetch. Nothing when the post is not about one version.
 */
async function previewImage(supabase: SupabaseClient, payload: Record<string, unknown>, alt: string, href: string): Promise<ChatImage | null> {
  if (typeof payload.versionId !== "string") return null;
  try {
    const { data } = await supabase.from("version_sides").select("preview_path,thumb_path").eq("version_id", payload.versionId).eq("side", "front").maybeSingle();
    const url = await signedUrl(supabase, data?.preview_path ?? data?.thumb_path, PREVIEW_LINK_DAYS * 86400);
    return url ? { url, alt: alt.replace(/^\S+\s/, ""), href } : null;
  } catch (e) { console.error("[chat preview]", (e as Error).message); return null; }
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

/** Active approvers of one organization. Approving is per organization (org_memberships.is_approver). */
export async function approverIds(supabase: SupabaseClient, orgId: string): Promise<string[]> {
  const { data } = await supabase.from("org_memberships").select("user_id,users!inner(status)").eq("org_id", orgId).eq("is_approver", true).eq("users.status", "active");
  return (data ?? []).map((m) => m.user_id as string);
}
