import Link from "next/link";
import { format } from "date-fns";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { SectionHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/labels";

export type { FormatCardData } from "@/components/events/format-grid";
export interface ActivityItem { id: string | number; who: string; initials: string; what: string; when: string }

export interface BriefView { date: string | null; timeText: string | null; inviteText: string | null; venueName: string | null; venueAddress: string | null; notes: string | null }
/** What goes on the designs: when, where, the invite text. */
export function BriefCard({ brief, locked, editHref }: { brief: BriefView; locked: boolean; editHref: string }) {
  const dt = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <section className="rounded-2xl bg-subtle p-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold leading-7 tracking-[-0.01em]">Brief</h2>{locked ? <StateBadge state="requested" label="Locked · changes via comments" /> : <Link href={editHref} className="text-sm font-medium underline-offset-4 hover:underline">Edit</Link>}</div>
      <dl className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <dt className={dt}>When</dt>
          <dd className="mt-1 text-sm font-medium">{brief.date ? format(new Date(brief.date + "T00:00:00"), "EEEE, d MMMM yyyy") : <span className="font-normal text-muted-foreground">Date not set</span>}</dd>
          {brief.timeText && <dd className="whitespace-pre-line text-sm">{brief.timeText}</dd>}
        </div>
        <div>
          <dt className={dt}>Where</dt>
          <dd className="mt-1 text-sm font-medium">{brief.venueName ?? <span className="font-normal text-muted-foreground">Venue not set</span>}</dd>
          {brief.venueAddress && <dd className="whitespace-pre-line text-sm text-muted-foreground">{brief.venueAddress}</dd>}
        </div>
      </dl>
      <div className="mt-5">
        <p className={dt}>Invite text</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{brief.inviteText ?? <span className="text-muted-foreground">Not written yet. Add the invite text before designs start.</span>}</p>
      </div>
      {brief.notes && <p className="mt-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">For designers:</span> {brief.notes}</p>}
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
