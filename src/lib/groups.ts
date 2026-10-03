import type { SupabaseClient } from "@supabase/supabase-js";

/** What a group hears about in its chat: everything, only designs its members work on (plus milestones), or milestones only. */
export type GroupHears = "all" | "own" | "milestones";
export interface Group { id: string; org_id: string; name: string; hears: GroupHears; chat_webhook_url: string | null; slack_webhook_url: string | null; members: string[] }

export const HEARS_LABEL: Record<GroupHears, { label: string; hint: string }> = {
  all: { label: "Everything", hint: "Every post for this organization." },
  own: { label: "Its own designs", hint: "Posts about designs its members work on, plus event published and all designs approved." },
  milestones: { label: "Milestones only", hint: "Only event published and all designs approved. Nothing per design unless the group is @mentioned." },
};

/** Groups of one or more organizations, with member ids. */
export async function loadGroups(supabase: SupabaseClient, orgIds: string[] | "all"): Promise<Group[]> {
  let q = supabase.from("groups").select("id,org_id,name,hears,chat_webhook_url,slack_webhook_url,group_members(user_id)").order("name");
  if (orgIds !== "all") q = q.in("org_id", orgIds);
  const { data } = await q;
  return ((data ?? []) as unknown as (Omit<Group, "members"> & { group_members: { user_id: string }[] })[]).map((g) => ({ ...g, members: g.group_members.map((m) => m.user_id) }));
}

/** @-mention handle for a group, e.g. "core-members". */
export const groupHandle = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
