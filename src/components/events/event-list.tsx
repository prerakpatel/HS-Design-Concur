import Link from "next/link";
import { format } from "date-fns";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";

export interface EventListItem { id: string; kind?: "event" | "assets"; title: string; venue: string | null; event_date: string | null; status: "draft" | "active" | "archived"; approved: number; uploaded?: number; total: number; people: { initials: string; avatar?: string | null }[]; needsYou?: boolean }

function badgeFor(e: EventListItem): { state: BadgeState; label?: string } {
  if (e.status === "draft") return { state: "draft" };
  if (e.status === "archived") return { state: "requested", label: "Archived" };
  if (e.needsYou) return { state: "needs_you" };
  if (e.total && e.approved === e.total) return { state: "approved", label: "All approved" };
  if (e.approved === 0) return { state: "requested", label: "Not started" };
  return { state: "in_review", label: "In progress" };
}

/** Approved in solid green; uploaded but not yet approved in a pale green behind it. */
function Progress({ e, className }: { e: EventListItem; className?: string }) {
  const pct = (n: number) => (e.total ? `${(n / e.total) * 100}%` : "0%");
  return (
    <div className={"relative h-1.5 overflow-hidden rounded-full bg-muted-strong " + (className ?? "")} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full bg-success/30" style={{ width: pct(Math.max(e.uploaded ?? 0, e.approved)) }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: pct(e.approved) }} />
    </div>
  );
}

/** "3 of 5 uploads · 1 approved": what's in first, then how much of it is final. */
function Counts({ e }: { e: EventListItem }) {
  const up = Math.max(e.uploaded ?? 0, e.approved);
  return <>{up} of {e.total} uploads{e.approved > 0 && <span className="text-muted-foreground/80"> · {e.approved} approved</span>}</>;
}

/** Events list: hairline rows, date tile, title + venue, progress, people, state. Mobile stacks the meta. */
export function EventList({ items, emptyTitle = "No events yet", emptyBody }: { items: EventListItem[]; emptyTitle?: string; emptyBody?: string }) {
  if (items.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-base font-medium">{emptyTitle}</p>
      {emptyBody && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{emptyBody}</p>}
    </div>
  );
  return (
    <ul className="divide-y divide-border">
      {items.map((e) => {
        const d = e.event_date ? new Date(e.event_date + "T00:00:00") : null; const b = badgeFor(e);
        return (
          <li key={e.id}>
            <Link href={`/events/${e.id}`} className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-subtle md:gap-6">
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted">
                <span className="text-lg font-semibold leading-none tracking-[-0.02em]">{d ? format(d, "d") : "—"}</span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{d ? format(d, "MMM") : "TBD"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium leading-6">{e.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{e.kind === "assets" ? <>Assets only{d ? ` · ends ${format(d, "d MMM")}` : ""}</> : (e.venue ?? "Venue not set")}</p>
                <div className="mt-1.5 space-y-1.5 md:hidden"><p className="truncate text-xs text-muted-foreground"><Counts e={e} /></p><Progress e={e} className="max-w-40" /></div>
              </div>
              <div className="hidden w-[210px] md:block">
                <p className="text-sm text-muted-foreground"><Counts e={e} /></p>
                <Progress e={e} className="mt-2" />
              </div>
              <div className="hidden w-[92px] items-center gap-1 md:flex">{e.people.slice(0, 3).map((p, i) => <UserAvatar key={i} initials={p.initials} src={p.avatar} size={28} />)}</div>
              <div className="hidden w-[120px] md:block"><StateBadge state={b.state} label={b.label} /></div>
              <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
