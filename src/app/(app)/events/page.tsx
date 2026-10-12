import { todayIso } from "@/lib/time";
import Link from "next/link";
import { capFor } from "@/lib/project";
import { requireActiveUser, initials } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { NewRequest } from "@/components/events/new-request";
import { EventList, type EventListItem } from "@/components/events/event-list";
import type { EventRow } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "upcoming" } = await searchParams;
  const { supabase, org, isApprover } = await requireActiveUser();
  const { data: events } = await supabase.from("events").select("*").eq("org_id", org.id).is("deleted_at", null).order("event_date", { ascending: true, nullsFirst: false }).returns<EventRow[]>();
  const { count: used } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null);
  const ids = (events ?? []).map((e) => e.id);
  const { data: slots } = ids.length ? await supabase.from("slots").select("event_id,state,requested,assignee:assignee_id(name,email,avatar_url),versions(count)").in("event_id", ids) : { data: [] as { event_id: string; state: string; requested: boolean; assignee: { name: string | null; email: string; avatar_url: string | null } | null; versions: { count: number }[] }[] };
  const agg = new Map<string, { total: number; approved: number; uploaded: number; people: { initials: string; avatar: string | null }[]; needsYou: boolean }>();
  const canApprove = isApprover;
  for (const s of slots ?? []) {
    if (!s.requested) continue;
    const a = agg.get(s.event_id) ?? { total: 0, approved: 0, uploaded: 0, people: [], needsYou: false };
    a.total++; if (s.state === "approved") a.approved++;
    // Uploaded = has at least one version (sent or not); approved ones count as uploaded too.
    if (s.state !== "requested" || ((s.versions as unknown as { count: number }[] | null)?.[0]?.count ?? 0) > 0) a.uploaded++; if (s.state === "in_review" && canApprove) a.needsYou = true;
    const who = s.assignee as unknown as { name: string | null; email: string; avatar_url: string | null } | null; if (who) { const ini = initials(who.name, who.email); if (!a.people.some((p) => p.initials === ini)) a.people.push({ initials: ini, avatar: who.avatar_url }); }
    agg.set(s.event_id, a);
  }
  const today = todayIso();
  const all: EventListItem[] = (events ?? []).map((e) => ({ id: e.id, title: e.title, venue: e.venue, event_date: e.event_date, status: e.status, kind: e.kind, ...(agg.get(e.id) ?? { total: 0, approved: 0, uploaded: 0, people: [], needsYou: false }) }));
  const groups = { upcoming: all.filter((e) => e.status === "active" && (!e.event_date || e.event_date >= today)), drafts: all.filter((e) => e.status === "draft"), // Past keeps archived events too (one reference image each), newest first.
    past: all.filter((e) => e.status === "archived" || (e.status === "active" && e.event_date && e.event_date < today)).sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? "")) };
  const items = groups[tab as keyof typeof groups] ?? groups.upcoming;
  return (
    <>
      <PageHeader title="Projects" subtitle={`${org.name} · ${used ?? 0} of ${capFor(org)} project slots in use`} actions={<NewRequest assets={!!org.asset_requests} />} />
      <nav className="mb-6 flex gap-6 border-b border-border text-sm font-medium">
        {(["upcoming", "drafts", "past"] as const).map((k) => <Link key={k} href={`/events?tab=${k}`} className={"-mb-px flex items-center gap-2 border-b-2 pb-3 capitalize " + (tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{k}<span className="text-sm font-normal text-muted-foreground">{groups[k].length}</span></Link>)}
      </nav>
      <EventList items={items} emptyTitle={tab === "drafts" ? "No drafts" : tab === "past" ? "Nothing past yet" : "Nothing in progress"} emptyBody={tab === "upcoming" ? `Start the first request for ${org.name} with New request.` : undefined} />
    </>
  );
}
