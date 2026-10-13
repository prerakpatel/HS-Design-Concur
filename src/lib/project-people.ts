import type { SupabaseClient } from "@supabase/supabase-js";
import { initials } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export interface ProjectPerson {
  email: string; userId: string | null; name: string; initials: string; avatar: string | null;
  /** Not a member of the project's organization: sees this project only. */
  guest: boolean; approver: boolean; creator: boolean; assigned: boolean;
  /** On the People list itself (removable); the creator and assigned designers are on it by being there. */
  listed: boolean;
  /** Has signed in at least once (a guest added by email may not have yet). */
  signedIn: boolean;
}

export interface ChatLink { platform: "slack" | "gchat"; label: string | null }

/**
 * The project's People list, or an empty list when it has none (then it is open to its organization as usual).
 * The caller's client decides whether the list may be read at all (members of the organization and the guests on
 * it); names, approver flags and memberships then come from the service client, for these people only, because a
 * guest may not read the organization's membership.
 */
export async function loadProjectPeople(supabase: SupabaseClient, event: { id: string; org_id: string; created_by: string }): Promise<ProjectPerson[]> {
  const { data: rows } = await supabase.from("project_members").select("email").eq("event_id", event.id);
  if (!rows?.length) return [];
  const db = createServiceClient();
  const { data: slots } = await db.from("slots").select("assignee_id").eq("event_id", event.id).not("assignee_id", "is", null);
  const assigned = new Set((slots ?? []).map((s) => s.assignee_id as string));
  const emails = rows.map((r) => r.email as string);
  const [{ data: listedUsers }, { data: workers }] = await Promise.all([
    db.from("users").select("id,name,email,avatar_url").in("email", emails),
    db.from("users").select("id,name,email,avatar_url").in("id", [event.created_by, ...assigned]),
  ]);
  const users = [...(listedUsers ?? []), ...(workers ?? [])];
  const ids = users.map((u) => u.id as string);
  const { data: members } = ids.length ? await db.from("org_memberships").select("user_id,is_approver").eq("org_id", event.org_id).in("user_id", ids) : { data: [] };
  const membership = new Map((members ?? []).map((m) => [m.user_id as string, !!m.is_approver]));
  const byEmail = new Map(users.map((u) => [(u.email as string).toLowerCase(), u]));
  const byId = new Map(users.map((u) => [u.id as string, u]));
  const person = (email: string, listed: boolean): ProjectPerson => {
    const u = byEmail.get(email);
    const id = (u?.id as string | undefined) ?? null;
    return {
      email, userId: id, name: (u?.name as string | null) ?? email.split("@")[0], initials: initials((u?.name as string | null) ?? null, email), avatar: (u?.avatar_url as string | null) ?? null,
      guest: !id || !membership.has(id), approver: !!id && !!membership.get(id), creator: id === event.created_by, assigned: !!id && assigned.has(id), listed, signedIn: !!id,
    };
  };
  const list = emails.map((e) => person(e, true));
  // The creator and assigned designers are on the project whether or not someone listed them.
  for (const id of [event.created_by, ...assigned]) {
    const u = byId.get(id); const email = (u?.email as string | undefined)?.toLowerCase();
    if (email && !list.some((p) => p.email === email)) list.push(person(email, false));
  }
  const rank = (p: ProjectPerson) => (p.creator ? 0 : p.approver ? 1 : p.guest ? 3 : 2);
  return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Whether the project posts to its own chat, and where (never the secret itself). Server only. */
export async function loadChatLink(eventId: string): Promise<ChatLink | null> {
  const { data } = await createServiceClient().from("project_chat").select("platform,label").eq("event_id", eventId).maybeSingle();
  return data ? { platform: data.platform as ChatLink["platform"], label: (data.label as string | null) ?? null } : null;
}

/**
 * Where a project's chat posts go. A project with its own chat posts there only; a project with guests but no chat
 * posts nowhere (its guests are emailed instead); any other project uses the organization's channels as before.
 * `guestIds` are the guests who have signed in. Server only.
 */
export async function projectRouting(eventId: string): Promise<{ target: string | null; private: boolean; guestIds: string[] }> {
  const db = createServiceClient();
  const [{ data: link }, { data: rows }, { data: event }] = await Promise.all([
    db.from("project_chat").select("target").eq("event_id", eventId).maybeSingle(),
    db.from("project_members").select("email").eq("event_id", eventId),
    db.from("events").select("org_id").eq("id", eventId).maybeSingle(),
  ]);
  const emails = (rows ?? []).map((r) => r.email as string);
  let guestIds: string[] = []; let hasGuests = false;
  if (emails.length && event) {
    const { data: users } = await db.from("users").select("id,email").in("email", emails);
    const ids = (users ?? []).map((u) => u.id as string);
    const { data: members } = ids.length ? await db.from("org_memberships").select("user_id").eq("org_id", event.org_id).in("user_id", ids) : { data: [] };
    const inOrg = new Set((members ?? []).map((m) => m.user_id as string));
    guestIds = ids.filter((id) => !inOrg.has(id));
    // Someone listed who has never signed in is a guest too.
    hasGuests = guestIds.length > 0 || emails.length > (users ?? []).length;
  }
  const target = (link?.target as string | undefined) ?? null;
  return { target, private: !!target || hasGuests, guestIds };
}

/** Of these projects, the ones whose posts must stay out of the organization's channels (own chat, or guests). */
export async function privateProjects(eventIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(eventIds)];
  if (!ids.length) return new Set();
  const db = createServiceClient();
  const [{ data: chats }, { data: rows }, { data: events }] = await Promise.all([
    db.from("project_chat").select("event_id").in("event_id", ids),
    db.from("project_members").select("event_id,email").in("event_id", ids),
    db.from("events").select("id,org_id").in("id", ids),
  ]);
  const out = new Set((chats ?? []).map((c) => c.event_id as string));
  const emails = [...new Set((rows ?? []).map((r) => r.email as string))];
  if (!emails.length) return out;
  const { data: users } = await db.from("users").select("id,email").in("email", emails);
  const userOf = new Map((users ?? []).map((u) => [(u.email as string).toLowerCase(), u.id as string]));
  const { data: members } = users?.length ? await db.from("org_memberships").select("user_id,org_id").in("user_id", users.map((u) => u.id as string)) : { data: [] };
  const inOrg = new Set((members ?? []).map((m) => `${m.user_id}:${m.org_id}`));
  const orgOf = new Map((events ?? []).map((e) => [e.id as string, e.org_id as string]));
  for (const r of rows ?? []) {
    const uid = userOf.get(r.email as string);
    if (!uid || !inOrg.has(`${uid}:${orgOf.get(r.event_id as string)}`)) out.add(r.event_id as string);
  }
  return out;
}
