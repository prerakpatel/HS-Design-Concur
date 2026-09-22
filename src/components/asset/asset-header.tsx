import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { BackLink } from "@/components/page-header";
import { ReviewActions } from "@/components/asset/review-actions";

export interface AssetHeaderProps {
  eventId: string; eventTitle: string; formatName: string; version: number | null; state: BadgeState; isPrimary: boolean; meta: string; uploader: string | null; notes: string | null;
  position: { at: number; total: number }; prev: { id: string; name: string } | null; next: { id: string; name: string } | null;
  actions: { versionId: string; decision: string; canApprove: boolean; isOwnUpload: boolean; hasBack: boolean } | null;
}

/**
 * Asset page chrome. Phone: one sticky row (back · title · prev/next) and a fixed bottom action bar in place of
 * the app tabs. Desktop: back pill + prev/next, then title, badges and actions.
 */
export function AssetHeader({ eventId, eventTitle, formatName, version, state, isPrimary, meta, uploader, notes, position, prev, next, actions }: AssetHeaderProps) {
  const slotHref = (id: string) => `/events/${eventId}/slots/${id}`;
  const review = actions && <ReviewActions versionId={actions.versionId} label={`${formatName} v${version ?? ""}`} eventTitle={eventTitle} decision={actions.decision} canApprove={actions.canApprove} isOwnUpload={actions.isOwnUpload} hasBack={actions.hasBack} />;
  return (
    <>
      <div className="sticky top-0 z-20 -mx-5 -mt-4 flex items-center gap-1 border-b border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
        <Button asChild variant="ghost" size="icon"><Link href={`/events/${eventId}`} aria-label={`Back to ${eventTitle}`}><Icon name="arrow_back" /></Link></Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold">{formatName}{version != null && <span className="ml-1.5 font-normal text-muted-foreground">v{version}</span>}</p>
          <p className="truncate text-[11px] text-muted-foreground">{eventTitle} · {position.at} of {position.total}</p>
        </div>
        {prev ? <Button asChild variant="ghost" size="icon"><Link href={slotHref(prev.id)} aria-label={`Previous: ${prev.name}`}><Icon name="chevron_left" /></Link></Button> : <Button variant="ghost" size="icon" disabled aria-label="First format"><Icon name="chevron_left" /></Button>}
        {next ? <Button asChild variant="ghost" size="icon"><Link href={slotHref(next.id)} aria-label={`Next: ${next.name}`}><Icon name="chevron_right" /></Link></Button> : <Button variant="ghost" size="icon" disabled aria-label="Last format"><Icon name="chevron_right" /></Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <StateBadge state={state} />
        {isPrimary && <StateBadge state="needs_you" label="Primary" />}
        <span className="text-xs text-muted-foreground">{meta}{uploader ? ` · by ${uploader}` : ""}</span>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <BackLink href={`/events/${eventId}`} label={eventTitle} />
        <div className="flex items-center gap-2">
          {prev ? <Button asChild variant="outline" size="sm"><Link href={slotHref(prev.id)}><Icon name="arrow_back" className="!text-[16px]" /><span className="max-w-[140px] truncate">{prev.name}</span></Link></Button> : <Button variant="outline" size="sm" disabled><Icon name="arrow_back" className="!text-[16px]" />First</Button>}
          <span className="text-xs text-muted-foreground">{position.at} of {position.total}</span>
          {next ? <Button asChild variant="outline" size="sm"><Link href={slotHref(next.id)}><span className="max-w-[140px] truncate">{next.name}</span><Icon name="arrow_forward" className="!text-[16px]" /></Link></Button> : <Button variant="outline" size="sm" disabled>Last<Icon name="arrow_forward" className="!text-[16px]" /></Button>}
        </div>
      </div>
      <div className="hidden flex-wrap items-start justify-between gap-4 md:flex">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] md:text-[26px]">{formatName}</h1>
            {version != null && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">v{version}</span>}
            <StateBadge state={state} />
            {isPrimary && <StateBadge state="needs_you" label="Primary" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{meta}{uploader && version != null ? ` · v${version} by ${uploader}` : ""}{notes ? ` · ${notes}` : ""}</p>
        </div>
        {review}
      </div>

      {actions && (actions.canApprove || actions.decision === "approved") && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden [&>div]:justify-end">{review}</div>
      )}
    </>
  );
}
