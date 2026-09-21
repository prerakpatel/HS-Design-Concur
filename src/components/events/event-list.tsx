import Link from "next/link";
import { format } from "date-fns";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";

export interface EventListItem { id: string; title: string; venue: string | null; event_date: string | null; status: "draft" | "active" | "archived"; approved: number; total: number; people: string[]; needsYou?: boolean }

function badgeFor(e: EventListItem): { state: BadgeState; label?: string } {
  if (e.status === "draft") return { state: "draft" };
  if (e.needsYou) return { state: "needs_you" };
  if (e.total && e.approved === e.total) return { state: "approved", label: "All approved" };
  if (e.approved === 0) return { state: "requested", label: "Not started" };
  return { state: "in_review", label: "In progress" };
}

/** Events list: hairline rows, date tile, title + venue, progress, people, state. Mobile stacks the meta. */
export function EventList({ items, emptyTitle = "No events yet", emptyBody }: { items: EventListItem[]; emptyTitle?: string; emptyBody?: string }) {
  if (items.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-base font-medium">{emptyTitle}</p>
      {emptyBody && <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted-foreground">{emptyBody}</p>}
    </div>
  );
  return (
    <ul className="divide-y divide-border">
      {items.map((e) => {
        const d = e.event_date ? new Date(e.event_date + "T00:00:00") : null; const b = badgeFor(e);
        return (
          <li key={e.id}>
            <Link href={`/events/${e.id}`} className="-mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 transition-colors hover:bg-subtle md:gap-6">
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted">
                <span className="text-[22px] font-semibold leading-none tracking-[-0.02em]">{d ? format(d, "d") : "—"}</span>
                <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d ? format(d, "MMM") : "TBD"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium leading-6">{e.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{e.venue ?? "Venue not set"}</p>
                <div className="mt-2 flex items-center gap-3 md:hidden"><div className="h-1.5 w-24 rounded-full bg-muted-strong"><div className="h-full rounded-full bg-success" style={{ width: e.total ? `${(e.approved / e.total) * 100}%` : 0 }} /></div><span className="text-xs text-muted-foreground">{e.approved} of {e.total} approved</span></div>
              </div>
              <div className="hidden w-[176px] md:block">
                <p className="text-sm text-muted-foreground">{e.approved} of {e.total} approved</p>
                <div className="mt-2 h-1.5 rounded-full bg-muted-strong"><div className="h-full rounded-full bg-success" style={{ width: e.total ? `${(e.approved / e.total) * 100}%` : 0 }} /></div>
              </div>
              <div className="hidden w-[96px] items-center gap-1 md:flex">{e.people.slice(0, 3).map((p, i) => <UserAvatar key={i} initials={p} size={28} />)}</div>
              <div className="hidden w-[132px] md:block"><StateBadge state={b.state} label={b.label} /></div>
              <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
