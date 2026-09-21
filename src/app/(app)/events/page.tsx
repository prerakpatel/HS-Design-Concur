import Link from "next/link";
import { format } from "date-fns";
import { requireActiveUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { EVENT_CAP } from "@/config/limits";
import type { EventRow } from "@/lib/types";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const { supabase, org } = await requireActiveUser();
  const { data: events } = await supabase.from("events").select("*").eq("org_id", org.id).is("deleted_at", null).neq("status", "archived").order("event_date", { ascending: true, nullsFirst: false }).returns<EventRow[]>();
  const { count: used } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  const ids = (events ?? []).map((e) => e.id);
  const { data: slots } = ids.length ? await supabase.from("slots").select("event_id,state,requested").in("event_id", ids) : { data: [] as { event_id: string; state: string; requested: boolean }[] };
  const progress = new Map<string, { total: number; approved: number }>();
  for (const s of slots ?? []) { if (!s.requested) continue; const p = progress.get(s.event_id) ?? { total: 0, approved: 0 }; p.total++; if (s.state === "approved") p.approved++; progress.set(s.event_id, p); }
  const list = events ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Events" subtitle={`${org.name} · ${used ?? 0} of ${EVENT_CAP} event slots in use`} actions={<Button asChild><Link href="/events/new">New event</Link></Button>} />
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm font-medium">No events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first event for {org.name}. The brief comes first, then formats.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((e) => {
            const p = progress.get(e.id) ?? { total: 0, approved: 0 };
            const d = e.event_date ? new Date(e.event_date + "T00:00:00") : null;
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex items-center gap-4 py-3 hover:bg-subtle -mx-2 px-2 rounded-lg">
                  <div className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
                    <span className="text-xl font-semibold leading-none">{d ? format(d, "d") : "—"}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">{d ? format(d, "MMM") : "TBD"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.venue ?? "Venue not set"} · {org.short_name}</p>
                  </div>
                  <div className="hidden w-[180px] md:block">
                    <p className="text-xs text-muted-foreground">{p.approved} of {p.total} approved</p>
                    <div className="mt-2 h-1 rounded-full bg-muted-strong"><div className="h-full rounded-full bg-success" style={{ width: p.total ? `${(p.approved / p.total) * 100}%` : 0 }} /></div>
                  </div>
                  <div className="w-[150px]">{e.status === "draft" ? <StateBadge state="draft" /> : p.total && p.approved === p.total ? <StateBadge state="approved" /> : <StateBadge state="requested" />}</div>
                  <Icon name="chevron_right" className="text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
