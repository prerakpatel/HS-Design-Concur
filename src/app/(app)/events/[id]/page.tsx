import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireActiveUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import type { EventRow, Format, Slot } from "@/lib/types";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, org } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const [{ data: brief }, { data: slots }, { data: formats }] = await Promise.all([
    supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<{ description: string | null; venue: string | null; notes: string | null }>(),
    supabase.from("slots").select("*").eq("event_id", id).returns<Slot[]>(),
    supabase.from("formats").select("*").order("sort").returns<Format[]>(),
  ]);
  const byFormat = new Map((slots ?? []).map((s) => [s.format_id, s]));
  const rows = (formats ?? []).map((f) => ({ format: f, slot: byFormat.get(f.id) }));
  const requested = rows.filter((r) => r.slot?.requested);
  const approved = requested.filter((r) => r.slot?.state === "approved").length;
  const d = event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "Date not set";
  return (
    <div className="space-y-6">
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrow_back" />Events</Link>
      <PageHeader title={event.title} subtitle={`${d} · ${event.venue ?? "Venue not set"} · ${org.name}`} actions={event.status === "draft" ? <StateBadge state="draft" /> : null} />
      <section className="rounded-2xl bg-subtle p-5">
        <div className="flex items-center gap-2"><h2 className="text-[17px] font-semibold">Brief</h2>{event.brief_locked_at ? <StateBadge state="requested" label="Locked · changes via comments" /> : <StateBadge state="draft" label="Editable until first upload" />}</div>
        <p className="mt-3 text-sm">{brief?.description ?? <span className="text-muted-foreground">No brief yet. Publication or a Core Admin adds the description, timings and venue in step 2.</span>}</p>
      </section>
      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold">Formats</h2><p className="text-xs text-muted-foreground">{approved} approved · {requested.length - approved} in progress · {rows.length - requested.length} N/A</p></div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ format: f, slot }) => {
            const na = !slot?.requested;
            const size = f.unit === "in" ? `${f.width} × ${f.height} in` : f.width ? `${f.width} × ${f.height}` : "custom size";
            return (
              <div key={f.id} className={"overflow-hidden rounded-2xl border border-border bg-card" + (na ? " opacity-55" : "")}>
                <div className={"relative aspect-[6/5] " + (na ? "bg-muted" : "bg-gradient-to-br from-[#fdf2ec] to-[#f8d9d1]")}>
                  <div className="absolute left-2.5 top-2.5"><StateBadge state={na ? "na" : (slot!.state as "requested")} /></div>
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{size}{slot?.due_on ? ` · Due ${format(new Date(slot.due_on + "T00:00:00"), "d MMM")}` : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
