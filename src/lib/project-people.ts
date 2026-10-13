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
 * The project's People list (the listed people plus its creator and assigned designers), or an empty list when it
 * has none (then it is open to its organization as usual). Read through project_people(), which answers members of
 * the organization and the project's guests only.
 */
type PeopleRow = { email: string; user_id: string | null; name: string | null; avatar_url: string | null; is_member: boolean; is_approver: boolean; is_creator: boolean; is_assigned: boolean; listed: boolean };

export async function loadProjectPeople(supabase: SupabaseClient, event: { id: string }): Promise<ProjectPerson[]> {
  const { data } = await supabase.rpc("project_people", { p_event: event.id });
  return toPeople((data ?? []) as PeopleRow[]);
}

/** Everything the project page's People button needs, in one request: the list, the chat, and who may change them. */
export async function loadProjectPanel(supabase: SupabaseClient, eventId: string): Promise<{ people: ProjectPerson[]; chat: ChatLink | null; canManage: boolean }> {
  const { data } = await supabase.rpc("project_panel", { p_event: eventId });
  const d = (data ?? {}) as { people?: PeopleRow[]; chat?: { platform: ChatLink["platform"]; label: string | null } | null; can_manage?: boolean };
  return { people: toPeople(d.people ?? []), chat: d.chat ? { platform: d.chat.platform, label: d.chat.label } : null, canManage: !!d.can_manage };
}

function toPeople(rows: PeopleRow[]): ProjectPerson[] {
  const list = rows.map((r): ProjectPerson => ({
    email: r.email, userId: r.user_id, name: r.name ?? r.email.split("@")[0], initials: initials(r.name, r.email), avatar: r.avatar_url,
    guest: !r.is_member, approver: r.is_member && r.is_approver, creator: r.is_creator, assigned: r.is_assigned, listed: r.listed, signedIn: !!r.user_id,
  }));
  const rank = (p: ProjectPerson) => (p.creator ? 0 : p.approver ? 1 : p.guest ? 3 : 2);
  return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Whether the project posts to its own chat, and where (never the secret link itself). */
export async function loadChatLink(supabase: SupabaseClient, eventId: string): Promise<ChatLink | null> {
  const { data } = await supabase.rpc("project_chat_info", { p_event: eventId });
  const row = (data as { platform: ChatLink["platform"]; label: string | null }[] | null)?.[0];
  return row ? { platform: row.platform, label: row.label } : null;
}

/**
 * Where a project's chat posts go: its own chat when one is connected, otherwise the organization's channels as
 * before. `guestIds` are the project's guests who have signed in (emailed only while there is no project chat).
 * Server only; null without the service key (then posts go where they always went).
 */
export async function projectRouting(eventId: string): Promise<{ target: string | null; guestIds: string[] } | null> {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  const db = createServiceClient();
  const [{ data: link }, { data: people }] = await Promise.all([
    db.from("project_chat").select("target").eq("event_id", eventId).maybeSingle(),
    db.rpc("project_people", { p_event: eventId }),
  ]);
  const guestIds = ((people ?? []) as { user_id: string | null; is_member: boolean }[]).filter((p) => p.user_id && !p.is_member).map((p) => p.user_id as string);
  return { target: (link?.target as string | undefined) ?? null, guestIds };
}

/** Of these projects, the ones with their own chat: their posts stay out of the organization's channels. */
export async function privateProjects(eventIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(eventIds)];
  if (!ids.length || !process.env.SUPABASE_SECRET_KEY) return new Set();
  const { data } = await createServiceClient().from("project_chat").select("event_id").in("event_id", ids);
  return new Set((data ?? []).map((c) => c.event_id as string));
}
