import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireActiveUser, initials } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { formatSize, relativeTime } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import type { EventRow, Format, Slot } from "@/lib/types";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, org } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const [{ data: brief }, { data: timings }, { data: slots }, { data: formats }, { data: activity }, { data: creator }] = await Promise.all([
    supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<{ description: string | null; venue: string | null; notes: string | null }>(),
    supabase.from("brief_timings").select("*").eq("event_id", id).order("sort"),
    supabase.from("slots").select("*,assignee:assignee_id(name,email),versions(number,decision,version_sides(side,thumb_path))").eq("event_id", id),
    supabase.from("formats").select("*").order("sort").returns<Format[]>(),
    supabase.from("activity").select("*,actor:actor_id(name,email)").eq("event_id", id).order("created_at", { ascending: false }).limit(12),
    supabase.from("users").select("name,email").eq("id", event.created_by).maybeSingle(),
  ]);
  const bySlotFormat = new Map((slots ?? []).map((s) => [s.format_id, s]));
  const rows = await Promise.all((formats ?? []).map(async (f) => {
    const slot = bySlotFormat.get(f.id) as (Slot & { assignee: { name: string | null; email: string } | null; versions: { number: number; decision: string; version_sides: { side: string; thumb_path: string | null }[] }[] }) | undefined;
    if (!slot) return null;
    const latest = [...(slot.versions ?? [])].sort((a, b) => b.number - a.number)[0];
    const thumbPath = latest?.version_sides?.find((s) => s.side === "front")?.thumb_path ?? null;
    const thumb = await signedUrl(supabase, thumbPath);
    return { f, slot, latest, thumb };
  }));
  const cards = rows.filter((r): r is NonNullable<typeof r> => !!r);
  const requested = cards.filter((c) => c.slot.requested);
  const approved = requested.filter((c) => c.slot.state === "approved").length;
  const d = event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "Date not set";
  return (
    <div className="space-y-6">
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrow_back" />Events</Link>
      <PageHeader title={event.title} subtitle={`${d} · ${event.venue ?? "Venue not set"} · ${org.name}${creator ? ` · Created by ${creator.name ?? creator.email}` : ""}`} actions={
        <>
          {event.status === "draft" && <StateBadge state="draft" />}
          <Button asChild variant="secondary"><Link href={`/events/${id}/edit/${event.status === "draft" ? "review" : "basics"}`}>{event.status === "draft" ? "Continue setup" : "Edit event"}</Link></Button>
        </>
      } />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-subtle p-5">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-[17px] font-semibold">Brief</h2>{event.brief_locked_at ? <StateBadge state="requested" label="Locked · changes via comments" /> : <Link href={`/events/${id}/edit/brief`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Edit</Link>}</div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{brief?.description ?? <span className="text-muted-foreground">No brief yet. Add the description, timings and venue before designs start.</span>}</p>
            {(timings?.length || brief?.venue) ? (
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {(timings ?? []).map((t) => <div key={t.id}><dt className="text-[11px] font-medium uppercase text-muted-foreground">{t.label ?? "Timing"}</dt><dd className="text-sm">{t.on_date ? format(new Date(t.on_date + "T00:00:00"), "EEE d MMM") : ""}{t.starts_at ? ` · ${t.starts_at.slice(0, 5)}` : ""}{t.ends_at ? `–${t.ends_at.slice(0, 5)}` : ""}</dd></div>)}
                {brief?.venue && <div><dt className="text-[11px] font-medium uppercase text-muted-foreground">Venue</dt><dd className="text-sm">{brief.venue}</dd></div>}
              </dl>
            ) : null}
            {brief?.notes && <p className="mt-3 text-xs text-muted-foreground">Notes: {brief.notes}</p>}
          </section>
          <section className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold">Formats</h2><p className="text-xs text-muted-foreground">{approved} approved · {requested.length - approved} in progress · {cards.length - requested.length} N/A</p></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {cards.map(({ f, slot, latest, thumb }) => {
                const na = !slot.requested;
                return (
                  <Link key={f.id} href={`/events/${id}/slots/${slot.id}`} className={"group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-foreground/20 " + (na ? "opacity-55" : "")}>
                    <div className={"relative aspect-[6/5] " + (na || !thumb ? "bg-muted" : "")}>
                      {thumb && <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" />}
                      {!thumb && !na && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Icon name="add_photo_alternate" size={24} /></div>}
                      <div className="absolute left-2.5 top-2.5"><StateBadge state={na ? "na" : slot.state} /></div>
                      {latest && <span className="absolute right-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium">v{latest.number}</span>}
                    </div>
                    <div className="space-y-1.5 p-3">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatSize(f, { w: slot.custom_w, h: slot.custom_h })}{slot.due_on ? ` · Due ${format(new Date(slot.due_on + "T00:00:00"), "d MMM")}` : ""}</p>
                      {slot.assignee && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><UserAvatar initials={initials(slot.assignee.name, slot.assignee.email)} size={24} />{slot.assignee.name ?? slot.assignee.email}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="space-y-4 lg:border-l lg:border-border lg:pl-5">
          <h2 className="text-[17px] font-semibold">Activity</h2>
          <ul className="space-y-4">
            {(activity ?? []).length === 0 && <li className="text-xs text-muted-foreground">Nothing yet.</li>}
            {(activity ?? []).map((a) => { const who = a.actor as unknown as { name: string | null; email: string } | null; const p = a.payload as Record<string, string>; const what = ({ "event.created": "created the event", "event.published": "published the event", "event.deleted": "deleted the event", "version.uploaded": `uploaded ${p.format} v${p.number}`, "version.approved": `approved ${p.format} v${p.number}`, "version.changes_requested": `requested changes on ${p.format} v${p.number}`, "version.reopened": `reopened ${p.format} v${p.number}` } as Record<string, string>)[a.kind] ?? a.kind; return (
              <li key={a.id} className="flex gap-2"><UserAvatar initials={initials(who?.name ?? null, who?.email ?? "?")} size={24} /><div className="min-w-0 text-xs"><p>{who?.name ?? who?.email ?? "Someone"} {what}</p><p className="text-muted-foreground">{relativeTime(a.created_at)}</p></div></li>
            ); })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
