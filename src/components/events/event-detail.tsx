import Link from "next/link";
import { BriefMore } from "@/components/events/brief-more";
import { EventBriefBody } from "@/components/events/brief-event";
import { format } from "date-fns";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { SectionHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/labels";

export type { FormatCardData } from "@/components/events/format-grid";
export interface ActivityItem { id: string | number; who: string; initials: string; avatar?: string | null; what: string; when: string }

export interface BriefView { date: string | null; timeText: string | null; inviteText: string | null; venueName: string | null; venueAddress: string | null; notes: string | null }
/** What goes on the designs: when, where, the invite text. */
export function BriefCard({ brief, locked, editHref, assets = false }: { brief: BriefView; locked: boolean; editHref: string; /** Assets-only request: an end date instead of when/where. */ assets?: boolean }) {
  const ask = assets ? "What is needed" : "Invite text";
  const dt = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <section className="rounded-2xl bg-subtle p-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold leading-7 tracking-[-0.01em]">Brief</h2>{locked ? <StateBadge state="requested" label="Locked · changes via comments" /> : <Link href={editHref} className="text-sm font-medium underline-offset-4 hover:underline">Edit</Link>}</div>
      {assets ? (
        // Requests are for people who know the drill: the end date and the first lines of what is needed. The rest
        // (what happens at the end, the type, the full text, notes) sits behind "See all details".
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-sm"><span className={dt}>Ends</span><span className="font-medium">{brief.date ? format(new Date(brief.date + "T00:00:00"), "EEEE, d MMMM yyyy") : <span className="font-normal text-muted-foreground">End date not set</span>}</span></p>
      ) : <EventBriefBody brief={brief} />}
      {assets && (
        <div className="mt-3">
          <BriefMore label={ask} text={brief.inviteText} notes={brief.notes} empty="Not written yet. Say what is needed before designs start."
            extra={<p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Assets only.</span> Not tied to an event. Files are cleared the day after the end date, so download the finals before then; nothing is kept.</p>} />
        </div>
      )}
    </section>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <aside className="lg:border-l lg:border-border lg:pl-6">
      <SectionHeader title="Activity" />
      <ul className="space-y-5">
        {items.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
        {items.map((a) => <li key={a.id} className="flex gap-3"><UserAvatar initials={a.initials} src={a.avatar} size={28} /><div className="min-w-0 text-sm leading-5"><p><span className="font-medium">{a.who}</span> {a.what}</p><p className="text-muted-foreground">{relativeTime(a.when)}</p></div></li>)}
      </ul>
    </aside>
  );
}
