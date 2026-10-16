import { todayIso } from "@/lib/time";
import Link from "next/link";
import { capFor } from "@/lib/project";
import { requireActiveUser } from "@/lib/auth";
import { eventListItems, sharedEvents } from "@/lib/event-items";
import { PageHeader } from "@/components/page-header";
import { NewRequest } from "@/components/events/new-request";
import { EventList } from "@/components/events/event-list";
import type { EventRow } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "upcoming" } = await searchParams;
  const { supabase, org, orgs, isApprover } = await requireActiveUser();
  const [{ data: events }, { count: used }, sharedRows] = await Promise.all([
    supabase.from("events").select("*").eq("org_id", org.id).is("deleted_at", null).order("event_date", { ascending: true, nullsFirst: false }).returns<EventRow[]>(),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null),
    // Projects in another organization whose People list has this person: they are a guest there.
    sharedEvents(supabase, orgs.map((o) => o.id)),
  ]);
  const [all, shared] = await Promise.all([eventListItems(supabase, events ?? [], (orgId) => orgId === org.id && isApprover), eventListItems(supabase, sharedRows, () => false)]);
  const today = todayIso();
  const groups = { upcoming: all.filter((e) => e.status === "active" && (!e.event_date || e.event_date >= today)), drafts: all.filter((e) => e.status === "draft"), // Past keeps archived events too (one reference image each), newest first.
    past: all.filter((e) => e.status === "archived" || (e.status === "active" && e.event_date && e.event_date < today)).sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? "")) };
  const items = groups[tab as keyof typeof groups] ?? groups.upcoming;
  return (
    <>
      <PageHeader title="Projects" subtitle={`${org.name} · ${used ?? 0} of ${capFor(org)} project slots in use`} subtitleClassName="hidden md:block" actions={<NewRequest assets={!!org.asset_requests} />} />
      {/* The assistant's hello card lands here for the people who have him (src/components/assistant/dock.tsx). */}
      <div id="dc-assistant-hello" className="empty:hidden" />
      <nav className="mb-6 flex gap-6 border-b border-border text-sm font-medium">
        {(["upcoming", "drafts", "past"] as const).map((k) => <Link key={k} href={`/events?tab=${k}`} className={"-mb-px flex items-center gap-2 border-b-2 pb-3 capitalize " + (tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{k}<span className="text-sm font-normal text-muted-foreground">{groups[k].length}</span></Link>)}
      </nav>
      <EventList items={items} emptyTitle={tab === "drafts" ? "No drafts" : tab === "past" ? "Nothing past yet" : "Nothing in progress"} emptyBody={tab === "upcoming" ? `Start the first request for ${org.name} with New request.` : undefined} />
      {tab === "upcoming" && shared.length > 0 && <section className="mt-12"><h2 className="mb-1 text-lg font-semibold">Shared with you</h2><p className="mb-4 text-sm text-muted-foreground">Projects of another organization that you were added to.</p><EventList items={shared} /></section>}
    </>
  );
}
