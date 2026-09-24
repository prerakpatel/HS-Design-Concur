import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { BackLink } from "@/components/page-header";

export interface AssetHeaderProps {
  eventId: string; eventTitle: string; formatName: string; size?: string;
  position: { at: number; total: number }; prev: { id: string; name: string } | null; next: { id: string; name: string } | null;
}

/**
 * Edge-to-edge sticky row that only answers "where am I, where next": back to the event, the format's name,
 * prev / next. Left-aligned so it never shifts with the label's length. State, uploader and the decision
 * live in the status card beside the artwork.
 */
export function AssetHeader({ eventId, eventTitle, formatName, size, position, prev, next }: AssetHeaderProps) {
  const slotHref = (id: string) => `/events/${eventId}/slots/${id}`;
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-2 py-2 md:gap-4 md:px-6 md:py-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden"><Link href={`/events/${eventId}`} aria-label={`Back to ${eventTitle}`}><Icon name="arrow_back" /></Link></Button>
        <div className="hidden md:block"><BackLink href={`/events/${eventId}`} label={eventTitle} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold md:text-base">{formatName}{size && <span className="ml-2 font-normal text-muted-foreground">{size}</span>}</p>
          <p className="truncate text-[11px] text-muted-foreground md:hidden">{eventTitle}</p>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <span className="text-xs text-muted-foreground">{position.at} of {position.total}</span>
          {prev ? <Button asChild variant="ghost" size="icon" title={prev.name}><Link href={slotHref(prev.id)} aria-label={`Previous: ${prev.name}`}><Icon name="chevron_left" /></Link></Button> : <Button variant="ghost" size="icon" disabled aria-label="First format"><Icon name="chevron_left" /></Button>}
          {next ? <Button asChild variant="ghost" size="icon" title={next.name}><Link href={slotHref(next.id)} aria-label={`Next: ${next.name}`}><Icon name="chevron_right" /></Link></Button> : <Button variant="ghost" size="icon" disabled aria-label="Last format"><Icon name="chevron_right" /></Button>}
        </div>
      </div>
    </div>
  );
}
