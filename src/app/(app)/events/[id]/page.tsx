import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireActiveUser, initials } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { formatSize } from "@/lib/labels";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { BriefCard, FormatGrid, ActivityFeed, type FormatCardData } from "@/components/events/event-detail";
import type { EventRow, Format, Slot } from "@/lib/types";

const VERB: Record<string, (p: Record<string, string>) => string> = { "event.created": () => "created the event", "event.published": () => "published the event", "event.deleted": () => "deleted the event", "version.uploaded": (p) => `uploaded ${p.format} v${p.number}`, "version.approved": (p) => `approved ${p.format} v${p.number}`, "version.changes_requested": (p) => `requested changes on ${p.format} v${p.number}`, "version.reopened": (p) => `reopened ${p.format} v${p.number}` };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, org } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const [{ data: brief }, { data: timings }, { data: slots }, { data: formats }, { data: activity }, { data: creator }] = await Promise.all([
    supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<{ description: string | null; venue: string | null; notes: string | null }>(),
    supabase.from("brief_timings").select("*").eq("event_id", id).order("sort"),
    supabase.from("slots").select("*,assignee:assignee_id(name,email),versions(number,version_sides(side,thumb_path))").eq("event_id", id),
    supabase.from("formats").select("*").order("sort").returns<Format[]>(),
    supabase.from("activity").select("*,actor:actor_id(name,email)").eq("event_id", id).order("created_at", { ascending: false }).limit(12),
    supabase.from("users").select("name,email").eq("id", event.created_by).maybeSingle(),
  ]);
  const bySlotFormat = new Map((slots ?? []).map((s) => [s.format_id, s]));
  const cards: FormatCardData[] = (await Promise.all((formats ?? []).map(async (f) => {
    const slot = bySlotFormat.get(f.id) as (Slot & { assignee: { name: string | null; email: string } | null; versions: { number: number; version_sides: { side: string; thumb_path: string | null }[] }[] }) | undefined;
    if (!slot) return null;
    const latest = [...(slot.versions ?? [])].sort((a, b) => b.number - a.number)[0];
    const thumb = await signedUrl(supabase, latest?.version_sides?.find((s) => s.side === "front")?.thumb_path ?? null);
    return { slotId: slot.id, name: f.name, size: formatSize(f, { w: slot.custom_w, h: slot.custom_h }), state: slot.state, requested: slot.requested, version: latest?.number ?? null, thumb, due: slot.due_on, assignee: slot.assignee ? { name: slot.assignee.name ?? slot.assignee.email, initials: initials(slot.assignee.name, slot.assignee.email) } : null } as FormatCardData;
  }))).filter((c): c is FormatCardData => !!c);
  const requested = cards.filter((c) => c.requested); const approved = requested.filter((c) => c.state === "approved").length;
  const d = event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "Date not set";
  return (
    <>
      <PageHeader back={<Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrow_back" className="!text-[18px]" />Events</Link>}
        title={event.title} subtitle={`${d} · ${event.venue ?? "Venue not set"}${creator ? ` · Created by ${creator.name ?? creator.email}` : ""}`}
        actions={<>{event.status === "draft" && <StateBadge state="draft" className="h-8 px-3 text-sm" />}<Button asChild variant="secondary"><Link href={`/events/${id}/edit/${event.status === "draft" ? "review" : "basics"}`}>{event.status === "draft" ? "Continue setup" : "Edit event"}</Link></Button></>} />
      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          <BriefCard description={brief?.description ?? null} venue={brief?.venue ?? null} notes={brief?.notes ?? null} locked={!!event.brief_locked_at} editHref={`/events/${id}/edit/brief`}
            timings={(timings ?? []).map((t) => ({ label: t.label ?? "Timing", when: [t.on_date ? format(new Date(t.on_date + "T00:00:00"), "EEE d MMM") : "", t.starts_at ? `${t.starts_at.slice(0, 5)}${t.ends_at ? "–" + t.ends_at.slice(0, 5) : ""}` : ""].filter(Boolean).join(" · ") }))} />
          <section>
            <SectionHeader title="Formats" meta={`${approved} approved · ${requested.length - approved} in progress · ${cards.length - requested.length} N/A`} />
            <FormatGrid eventId={id} cards={cards} />
          </section>
        </div>
        <ActivityFeed items={(activity ?? []).map((a) => { const who = a.actor as unknown as { name: string | null; email: string } | null; return { id: a.id, who: who?.name ?? who?.email ?? "Someone", initials: initials(who?.name ?? null, who?.email ?? "?"), what: (VERB[a.kind] ?? (() => a.kind))(a.payload as Record<string, string>), when: a.created_at }; })} />
      </div>
    </>
  );
}
