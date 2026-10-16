"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { UserError } from "@/lib/user-error";
import { createServiceClient } from "@/lib/supabase/service";
import { loadProjectPeople } from "@/lib/project-people";
import { approverIds } from "@/lib/notify";
import { appUrl } from "@/lib/email";
import { postChat, parseChatTarget, platformOf, mention, chat, plainChat, SLACK_CHANNEL, type ChatUser } from "@/lib/chat";

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i;

/** The project, for someone allowed to change its People list and chat (creator, approvers, designers, Core Admins). */
async function manageable(eventId: string) {
  const ctx = await requireActiveUser();
  const { data: event } = await ctx.supabase.from("events").select("id,org_id,title,status,created_by").eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (!event) throw new UserError("Project not found");
  if (event.status === "archived") throw new UserError("Archived projects are read-only");
  const { data: can } = await ctx.supabase.rpc("can_manage_project", { p_event: eventId });
  if (!can) throw new UserError("Only the project's creator, approvers, designers and Core Admins can change who is on it");
  return { ...ctx, event: event as { id: string; org_id: string; title: string; status: string; created_by: string } };
}

/**
 * Add someone to the project by email. Someone outside the project's organization becomes a guest: they see this
 * project only, from their first Google sign-in with that email. The first person added also lists the
 * organization's approvers and Core Admins, so the list starts with everyone who has to be in the project's chat.
 */
export async function addProjectPerson(eventId: string, rawEmail: string) {
  const { supabase, user, event } = await manageable(eventId);
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new UserError("That doesn't look like an email address");
  const db = createServiceClient();
  const { data: who } = await db.from("users").select("id,name,email,status,slack_user_id,gchat_user_id").ilike("email", email).maybeSingle();
  if (who?.status === "removed") throw new UserError("This person's access was removed. A Core Admin can restore them in Settings → People first.");
  if (who?.status === "disabled") throw new UserError("This person's access is turned off. A Core Admin can enable them in Settings → Users first.");

  const { count } = await supabase.from("project_members").select("email", { count: "exact", head: true }).eq("event_id", eventId);
  const emails = new Set([email]);
  if (!count) {
    const approvers = await approverIds(db, event.org_id);
    const { data: admins } = await db.from("users").select("id,org_memberships!inner(org_id)").eq("status", "active").eq("role", "core_admin").eq("org_memberships.org_id", event.org_id);
    const ids = [...new Set([...approvers, ...(admins ?? []).map((a) => a.id as string)])].filter((id) => id !== event.created_by);
    const { data: staff } = ids.length ? await db.from("users").select("email").in("id", ids) : { data: [] };
    for (const s of staff ?? []) emails.add((s.email as string).toLowerCase());
  }
  const { error } = await supabase.from("project_members").upsert([...emails].map((e) => ({ event_id: eventId, email: e, added_by: user.id })), { onConflict: "event_id,email", ignoreDuplicates: true });
  if (error) throw new UserError(error.message);

  // Someone who signed in before and is still waiting for access is let in as a guest; their request is closed.
  if (who?.status === "pending") {
    const { count: orgs } = await db.from("org_memberships").select("org_id", { count: "exact", head: true }).eq("user_id", who.id);
    if (!orgs) {
      await db.from("users").update({ status: "active" }).eq("id", who.id);
      await db.from("access_requests").update({ decided_at: new Date().toISOString(), decided_by: user.id, decision: "approved" }).eq("user_id", who.id).is("decided_at", null);
    }
  }

  // Tell the project's chat, so the new person finds the link where the conversation already is.
  const { data: link } = await db.from("project_chat").select("target").eq("event_id", eventId).maybeSingle();
  if (link) {
    const platform = platformOf(link.target as string);
    const name = who ? mention(who as ChatUser, platform) : chat.bold(email);
    await postChat(link.target as string, `${name} was added to ${chat.bold(plainChat(event.title))}. ${chat.link(appUrl(`/events/${eventId}`), "Open the project")} and sign in with Google as ${email}.`);
  }
  revalidatePath(`/events/${eventId}`);
  return { chat: !!link };
}

/** The organization's members not on the list yet, offered while typing an email (loaded when the panel opens). */
export async function projectSuggestions(eventId: string, exclude: string[]) {
  const { supabase, event } = await manageable(eventId);
  const { data } = await supabase.from("users").select("name,email,org_memberships!inner(org_id)").eq("status", "active").eq("hide_in_lists", false).eq("org_memberships.org_id", event.org_id);
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  return ((data ?? []) as { name: string | null; email: string }[]).filter((u) => !skip.has(u.email.toLowerCase())).map((u) => ({ email: u.email.toLowerCase(), name: u.name ?? u.email }));
}

/** Take someone off the People list. The creator and assigned designers stay; at least one approver must stay. */
export async function removeProjectPerson(eventId: string, email: string) {
  const { supabase, event } = await manageable(eventId);
  const people = await loadProjectPeople(supabase, event);
  const p = people.find((x) => x.email === email.toLowerCase());
  if (!p?.listed) throw new UserError(p ? "The creator and assigned designers stay on the project" : "Not on this project");
  if (p.approver && people.filter((x) => x.approver).length <= 1) throw new UserError("Keep at least one approver on the project");
  const { error } = await supabase.from("project_members").delete().eq("event_id", eventId).eq("email", p.email);
  if (error) throw new UserError(error.message);
  revalidatePath(`/events/${eventId}`);
}

/**
 * Connect the project's own chat: a Slack channel link (the app must be invited to the channel), or a Slack or
 * Google Chat webhook. A hello goes to the channel first, naming everyone on the project; only if it lands is the
 * link saved. From then on this project's updates go only there, never to the organization's channels.
 */
export async function connectProjectChat(eventId: string, raw: string) {
  const { supabase, user, event } = await manageable(eventId);
  const parsed = parseChatTarget(raw);
  if (!parsed) throw new UserError("Paste a Slack channel link (right-click the channel → Copy link), or a Slack or Google Chat webhook link");
  let label: string | null = parsed.platform === "gchat" ? "Google Chat space" : "Slack channel";
  if (parsed.kind === "channel" && process.env.SLACK_BOT_TOKEN) {
    // The channel's name, when the app may read it (channels:read / groups:read); the link alone has only the ID.
    try {
      const res = await fetch(`https://slack.com/api/conversations.info?channel=${parsed.target.slice(SLACK_CHANNEL.length)}`, { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }, cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; channel?: { name?: string } };
      if (data.ok && data.channel?.name) label = `#${data.channel.name}`;
    } catch { /* keep the generic label */ }
  }
  const people = await loadProjectPeople(supabase, event);
  const ids = people.map((p) => p.userId).filter((id): id is string => !!id);
  const { data: chatUsers } = ids.length ? await createServiceClient().from("users").select("id,name,email,slack_user_id,gchat_user_id").in("id", ids) : { data: [] };
  const names = ((chatUsers ?? []) as ChatUser[]).map((u) => mention(u, parsed.platform)).join(" ");
  const waiting = people.filter((p) => !p.signedIn).map((p) => p.email);
  const text = [
    `${chat.bold(plainChat(event.title))} is connected to this ${parsed.platform === "gchat" ? "space" : "channel"}. Updates for this project post here, and only here.`,
    names, waiting.length ? `Not signed in yet: ${waiting.join(", ")}. Sign in with Google using that email.` : "",
    chat.link(appUrl(`/events/${eventId}`), "Open the project"),
  ].filter(Boolean).join("\n");
  const res = await postChat(parsed.target, text);
  if ("error" in res) throw new UserError(res.error);
  const { error } = await createServiceClient().from("project_chat").upsert({ event_id: eventId, target: parsed.target, platform: parsed.platform, label, connected_by: user.id, connected_at: new Date().toISOString() });
  if (error) throw new UserError(error.message);
  revalidatePath(`/events/${eventId}`);
}

export async function disconnectProjectChat(eventId: string) {
  await manageable(eventId);
  await createServiceClient().from("project_chat").delete().eq("event_id", eventId);
  revalidatePath(`/events/${eventId}`);
}
