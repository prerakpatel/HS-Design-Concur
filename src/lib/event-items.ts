import type { SupabaseClient } from "@supabase/supabase-js";
import { initials } from "@/lib/auth";
import type { EventListItem } from "@/components/events/event-list";
import type { EventRow } from "@/lib/types";

type SlotAgg = { event_id: string; state: string; requested: boolean; assignee: { name: string | null; email: string; avatar_url: string | null } | null; versions: { count: number }[] };

/** Project rows for a list: progress counts, the designers' faces, and "needs you" for someone who approves there. */
export async function eventListItems(supabase: SupabaseClient, events: EventRow[], approvesIn: (orgId: string) => boolean): Promise<EventListItem[]> {
  const ids = events.map((e) => e.id);
  const { data: slots } = ids.length ? await supabase.from("slots").select("event_id,state,requested,assignee:assignee_id(name,email,avatar_url),versions(count)").in("event_id", ids).returns<SlotAgg[]>() : { data: [] as SlotAgg[] };
  const orgOf = new Map(events.map((e) => [e.id, e.org_id]));
  const agg = new Map<string, { total: number; approved: number; uploaded: number; people: { initials: string; avatar: string | null }[]; needsYou: boolean }>();
  for (const s of slots ?? []) {
    if (!s.requested) continue;
    const a = agg.get(s.event_id) ?? { total: 0, approved: 0, uploaded: 0, people: [], needsYou: false };
    a.total++; if (s.state === "approved") a.approved++;
    // Uploaded = has at least one version (sent or not); approved ones count as uploaded too.
    if (s.state !== "requested" || (s.versions?.[0]?.count ?? 0) > 0) a.uploaded++;
    if (s.state === "in_review" && approvesIn(orgOf.get(s.event_id) ?? "")) a.needsYou = true;
    const who = s.assignee; if (who) { const ini = initials(who.name, who.email); if (!a.people.some((p) => p.initials === ini)) a.people.push({ initials: ini, avatar: who.avatar_url }); }
    agg.set(s.event_id, a);
  }
  return events.map((e) => ({ id: e.id, title: e.title, venue: e.venue, event_date: e.event_date, status: e.status, kind: e.kind, ...(agg.get(e.id) ?? { total: 0, approved: 0, uploaded: 0, people: [], needsYou: false }) }));
}

/** Published projects this person sees only because they are on the People list (a guest there, not a member). */
export async function sharedEvents(supabase: SupabaseClient, memberOrgIds: string[]): Promise<EventRow[]> {
  let q = supabase.from("events").select("*").eq("status", "active").is("deleted_at", null).order("event_date", { ascending: true, nullsFirst: false });
  if (memberOrgIds.length) q = q.not("org_id", "in", `(${memberOrgIds.join(",")})`);
  return ((await q.returns<EventRow[]>()).data) ?? [];
}
