import Link from "next/link";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { SectionHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/labels";

export type { FormatCardData } from "@/components/events/format-grid";
export interface ActivityItem { id: string | number; who: string; initials: string; what: string; when: string }

export function BriefCard({ description, timings, venue, notes, locked, editHref }: { description: string | null; timings: { label: string; when: string }[]; venue: string | null; notes: string | null; locked: boolean; editHref: string }) {
  return (
    <section className="rounded-2xl bg-subtle p-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold leading-7 tracking-[-0.01em]">Brief</h2>{locked ? <StateBadge state="requested" label="Locked · changes via comments" /> : <Link href={editHref} className="text-sm font-medium underline-offset-4 hover:underline">Edit</Link>}</div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{description ?? <span className="text-muted-foreground">No brief yet. Add the description, timings and venue before designs start.</span>}</p>
      {(timings.length > 0 || venue) && (
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          {timings.map((t, i) => <div key={i}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</dt><dd className="mt-1 text-sm">{t.when}</dd></div>)}
          {venue && <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Venue</dt><dd className="mt-1 text-sm">{venue}</dd></div>}
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
