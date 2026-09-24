"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { approveMany } from "@/app/actions/reviews";
import { cn } from "@/lib/utils";

export interface FormatCardData { slotId: string; name: string; size: string; state: BadgeState; requested: boolean; version: number | null; versionId: string | null; uploadedByMe?: boolean; thumb: string | null; due: string | null; assignee: { name: string; initials: string; avatar?: string | null } | null; isPrimary?: boolean }

/**
 * Format cards: media-first, badge and version overlaid, 2 columns on phones, 3 on desktop.
 * Approvers get a Select mode to approve several in-review formats at once (PRD §6.2, no Approve All).
 */
export function FormatGrid({ eventId, cards, canApprove = false, meta }: { eventId: string; cards: FormatCardData[]; canApprove?: boolean; meta?: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const selecting = picked.length > 0;
  const [confirm, setConfirm] = useState(false);
  const [showNa, setShowNa] = useState(false);
  const naCount = cards.filter((c) => !c.requested).length;
  const visible = showNa ? cards : cards.filter((c) => c.requested);
  const [pending, start] = useTransition();
  const router = useRouter();
  const eligible = cards.filter((c) => c.requested && c.state === "in_review" && c.versionId && !c.uploadedByMe);
  const canBulk = canApprove && eligible.length > 0;
  const chosen = eligible.filter((c) => picked.includes(c.slotId));
  const stop = () => { setPicked([]); setConfirm(false); };
  const approve = () => start(async () => {
    const r = await approveMany(chosen.map((c) => c.versionId!));
    if (r.approved) toast.success(`Approved ${r.approved} format${r.approved === 1 ? "" : "s"}`);
    for (const f of r.failed) toast.error(f);
    stop(); router.refresh();
  });

  return (
    <section>
      <SectionHeader title="Formats" meta={meta} action={naCount > 0 && <Button variant="ghost" size="sm" onClick={() => setShowNa((v) => !v)}>{showNa ? "Hide N/A" : `Show N/A (${naCount})`}</Button>} />
      {/* Bulk approve: approvers get a checkbox on each in-review card (hover on desktop, always on touch). Ticking one brings up the action bar. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {visible.map((c) => {
          const selectable = canBulk && eligible.some((e) => e.slotId === c.slotId);
          const on = picked.includes(c.slotId);
          const toggle = () => setPicked((p) => on ? p.filter((x) => x !== c.slotId) : [...p, c.slotId]);
          return (
            <div key={c.slotId} className={cn("group relative", selecting && !selectable && "opacity-55")}>
              <Link href={`/events/${eventId}/slots/${c.slotId}`} className={cn("block w-full overflow-hidden rounded-2xl border bg-card text-left transition", "border-border hover:border-foreground/25 hover:shadow-sm", !c.requested && "opacity-55")}>
                <div className={"relative aspect-[5/4] " + (c.thumb ? "bg-canvas" : "bg-muted")}>
                  {c.thumb && <img src={c.thumb} alt="" className="absolute inset-0 size-full object-cover" />}
                  {!c.thumb && c.requested && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Icon name="add_photo_alternate" size={24} /></div>}
                  <div className="absolute bottom-3 left-3"><StateBadge state={c.requested ? c.state : "na"} /></div>
                  {c.version != null && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm">v{c.version}</span>}
                  {c.isPrimary && <span className={cn("absolute top-3 rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground shadow-sm", selectable ? "left-11" : "left-3")}>Primary</span>}
                </div>
                <div className="space-y-1.5 p-3.5">
                  <p className="truncate text-sm font-medium leading-5">{c.name}</p>
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-muted-foreground"><span>{c.size}</span>{c.due && <span className="ml-auto text-xs">Due {format(new Date(c.due + "T00:00:00"), "d MMM")}</span>}</p>
                  {c.assignee && <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground"><UserAvatar initials={c.assignee.initials} src={c.assignee.avatar} size={24} /><span className="truncate">{c.assignee.name}</span></p>}
                </div>
              </Link>
              {selectable && (
                <button type="button" role="checkbox" aria-checked={on} aria-label={`Select ${c.name}`} onClick={toggle}
                  className={cn("absolute left-2.5 top-2.5 z-10 flex size-6 items-center justify-center rounded-full text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "drop-shadow-[0_1px_3px_rgba(0,0,0,.45)]" : "border-2 border-white bg-white/15 shadow-[0_1px_3px_rgba(0,0,0,.35)] hover:bg-white/30")}>
                  {on && <Icon name="check_circle" size={24} fill />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selecting && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-2 pl-4 shadow-lg backdrop-blur md:bottom-6">
          <span className="text-sm font-medium">{chosen.length} selected</span>
          <div className="flex gap-2"><Button variant="ghost" onClick={stop}>Cancel</Button><Button disabled={chosen.length === 0 || pending} onClick={() => setConfirm(true)}>Approve {chosen.length || ""}</Button></div>
        </div>
      )}

      <Dialog open={confirm} onOpenChange={(o) => !o && setConfirm(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Approve {chosen.length} format{chosen.length === 1 ? "" : "s"}?</DialogTitle><DialogDescription>Each becomes the approved version, the watermark comes off, and the designers and publishers are notified.</DialogDescription></DialogHeader>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">{chosen.map((c) => <li key={c.slotId} className="flex items-center gap-2"><Icon name="check" className="!text-[18px] text-success" />{c.name} <span className="text-muted-foreground">v{c.version}</span></li>)}</ul>
          <DialogFooter><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button onClick={approve} disabled={pending}>{pending ? "Approving…" : "Approve"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
