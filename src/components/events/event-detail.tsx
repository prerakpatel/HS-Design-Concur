import Link from "next/link";
import { format } from "date-fns";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { SectionHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/labels";

export interface FormatCardData { slotId: string; name: string; size: string; state: BadgeState; requested: boolean; version: number | null; thumb: string | null; due: string | null; assignee: { name: string; initials: string } | null }
export interface ActivityItem { id: string | number; who: string; initials: string; what: string; when: string }

/** Format cards: media-first, badge and version overlaid, 2 columns on phones, up to 4 on desktop. */
export function FormatGrid({ eventId, cards }: { eventId: string; cards: FormatCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
      {cards.map((c) => (
        <Link key={c.slotId} href={`/events/${eventId}/slots/${c.slotId}`} className={"group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-foreground/25 hover:shadow-sm " + (c.requested ? "" : "opacity-55")}>
          <div className={"relative aspect-[5/4] " + (c.thumb ? "bg-canvas" : "bg-muted")}>
            {c.thumb && <img src={c.thumb} alt="" className="absolute inset-0 size-full object-cover" />}
            {!c.thumb && c.requested && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Icon name="add_photo_alternate" size={24} /></div>}
            <div className="absolute bottom-3 left-3"><StateBadge state={c.requested ? c.state : "na"} /></div>
            {c.version != null && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm">v{c.version}</span>}
          </div>
          <div className="space-y-2 p-4">
            <p className="truncate text-[15px] font-medium leading-5">{c.name}</p>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-muted-foreground"><span>{c.size}</span>{c.due && <span className="ml-auto text-xs">Due {format(new Date(c.due + "T00:00:00"), "d MMM")}</span>}</p>
            {c.assignee && <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground"><UserAvatar initials={c.assignee.initials} size={24} /><span className="truncate">{c.assignee.name}</span></p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function BriefCard({ description, timings, venue, notes, locked, editHref }: { description: string | null; timings: { label: string; when: string }[]; venue: string | null; notes: string | null; locked: boolean; editHref: string }) {
  return (
    <section className="rounded-2xl bg-subtle p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold leading-7 tracking-[-0.01em]">Brief</h2>{locked ? <StateBadge state="requested" label="Locked · changes via comments" /> : <Link href={editHref} className="text-sm font-medium underline-offset-4 hover:underline">Edit</Link>}</div>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{description ?? <span className="text-muted-foreground">No brief yet. Add the description, timings and venue before designs start.</span>}</p>
      {(timings.length > 0 || venue) && (
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          {timings.map((t, i) => <div key={i}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</dt><dd className="mt-1 text-[15px]">{t.when}</dd></div>)}
          {venue && <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Venue</dt><dd className="mt-1 text-[15px]">{venue}</dd></div>}
        </dl>
      )}
      {notes && <p className="mt-4 text-sm text-muted-foreground">Notes: {notes}</p>}
    </section>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <aside className="lg:border-l lg:border-border lg:pl-6">
      <SectionHeader title="Activity" />
      <ul className="space-y-5">
        {items.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
        {items.map((a) => <li key={a.id} className="flex gap-3"><UserAvatar initials={a.initials} size={28} /><div className="min-w-0 text-sm leading-5"><p><span className="font-medium">{a.who}</span> {a.what}</p><p className="text-muted-foreground">{relativeTime(a.when)}</p></div></li>)}
      </ul>
    </aside>
  );
}
