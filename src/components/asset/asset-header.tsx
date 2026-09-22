import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { BackLink } from "@/components/page-header";

export interface AssetHeaderProps {
  eventId: string; eventTitle: string; formatName: string; version: number | null; state: BadgeState;
  position: { at: number; total: number }; prev: { id: string; name: string } | null; next: { id: string; name: string } | null;
}

/**
 * One sticky row that answers "where am I, where next": back to the event, the format's name, version and state,
 * prev / next. Everything else (uploader, size, actions, versions) lives in the status panel beside the canvas.
 * Actions live in the footer bar.
 */
export function AssetHeader({ eventId, eventTitle, formatName, version, state, position, prev, next }: AssetHeaderProps) {
  const slotHref = (id: string) => `/events/${eventId}/slots/${id}`;
  return (
    <>
      <div className="sticky top-0 z-20 -mx-5 -mt-4 flex items-center gap-1 border-b border-border bg-card/95 px-2 py-2 backdrop-blur md:-mx-10 md:-mt-8 md:gap-3 md:px-6 md:py-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden"><Link href={`/events/${eventId}`} aria-label={`Back to ${eventTitle}`}><Icon name="arrow_back" /></Link></Button>
        <div className="hidden md:block"><BackLink href={`/events/${eventId}`} label={eventTitle} /></div>
        <div className="min-w-0 flex-1 text-center md:flex md:items-center md:justify-center md:gap-2.5 md:text-left">
          <p className="truncate text-sm font-semibold md:text-base">{formatName}{version != null && <span className="ml-1.5 font-normal text-muted-foreground">v{version}</span>}</p>
          <p className="truncate text-[11px] text-muted-foreground md:hidden">{eventTitle} · {position.at} of {position.total}</p>
          <span className="hidden md:inline-flex"><StateBadge state={state} /></span>
        </div>
        <div className="flex items-center md:gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">{position.at} of {position.total}</span>
          {prev ? <Button asChild variant="ghost" size="icon" title={prev.name}><Link href={slotHref(prev.id)} aria-label={`Previous: ${prev.name}`}><Icon name="chevron_left" /></Link></Button> : <Button variant="ghost" size="icon" disabled aria-label="First format"><Icon name="chevron_left" /></Button>}
          {next ? <Button asChild variant="ghost" size="icon" title={next.name}><Link href={slotHref(next.id)} aria-label={`Next: ${next.name}`}><Icon name="chevron_right" /></Link></Button> : <Button variant="ghost" size="icon" disabled aria-label="Last format"><Icon name="chevron_right" /></Button>}
        </div>
      </div>
    </>
  );
}

/** Status panel: what this is and who made it. Doing lives in the footer bar. */
export function StatusPanel({ state, isPrimary, meta, uploader, uploadedAt, notes }: { state: BadgeState; isPrimary: boolean; meta: string; uploader: string | null; uploadedAt: string | null; notes: string | null }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2"><StateBadge state={state} />{isPrimary && <StateBadge state="needs_you" label="Primary" />}</div>
      <div className="space-y-0.5 text-sm">
        {uploader && <p className="font-medium">{uploader}{uploadedAt ? <span className="font-normal text-muted-foreground"> · {uploadedAt}</span> : null}</p>}
        <p className="text-muted-foreground">{meta}</p>
        {notes && <p className="text-muted-foreground">Note: {notes}</p>}
      </div>
    </div>
  );
}
