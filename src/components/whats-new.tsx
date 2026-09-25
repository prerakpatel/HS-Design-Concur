"use client";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { markChangelogSeen, shareRelease } from "@/app/actions/changelog";
import type { Release } from "@/config/changelog";
import { cn } from "@/lib/utils";

// icons: auto_awesome check_circle
export interface ChangelogState { releases: Release[]; unseen: boolean; canShare: boolean; sharedIds: string[] }
const OPEN_EVENT = "dc:whats-new";
/** Any button can open the dialog without threading state through the tree. */
export function openWhatsNew() { window.dispatchEvent(new Event(OPEN_EVENT)); }

/**
 * "What's new": release notes as a dialog. Opens by itself the first time someone arrives after a release (once per
 * release, per person, remembered server-side), and from the sidebar / Profile sparkle any time after.
 */
export function WhatsNewDialog({ state }: { state: ChangelogState }) {
  const params = useSearchParams();
  // Opens on arrival when unread (or when a chat link asks for it); after that only on request.
  const [open, setOpen] = useState(() => state.unseen || !!params.get("whats-new"));
  const [pending, start] = useTransition();
  const latest = state.releases[0];
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);
  const close = (o: boolean) => { setOpen(o); if (!o && state.unseen) start(async () => { await markChangelogSeen(); }); };
  if (!latest) return null;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-0 sm:max-w-[520px]">
        <div className="bg-[linear-gradient(135deg,var(--brand-soft),var(--cream,#F9F6E2))] px-7 pb-6 pt-8">
          <DialogHeader className="text-left">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-brand-foreground"><Icon name="auto_awesome" className="!text-[16px]" fill />What&apos;s new</p>
            <DialogTitle className="mt-2 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-foreground">{latest.title}</DialogTitle>
            <DialogDescription className="text-sm text-foreground/70">{fmtDate(latest.id)}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-7 pb-7 pt-5">
          <ul className="space-y-3">
            {latest.items.map((item) => <li key={item} className="flex gap-3 text-[15px] leading-6"><Icon name="check_circle" className="mt-0.5 shrink-0 !text-[20px] text-success-text" fill />{item}</li>)}
          </ul>
          {state.releases.length > 1 && (
            <details className="mt-6 text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Earlier releases</summary>
              {state.releases.slice(1).map((r) => <div key={r.id} className="mt-4"><p className="font-medium text-foreground">{r.title} <span className="font-normal text-muted-foreground">· {fmtDate(r.id)}</span></p><ul className="mt-1.5 list-disc space-y-1 pl-5">{r.items.map((i) => <li key={i}>{i}</li>)}</ul></div>)}
            </details>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            {state.canShare ? (state.sharedIds.includes(latest.id)
              ? <span className="text-sm text-muted-foreground">Shared in chat</span>
              : <Button variant="outline" disabled={pending} onClick={() => start(async () => { try { await shareRelease(latest.id); toast.success("Posted to the team chat"); } catch (e) { toast.error((e as Error).message); } })}>Share in chat</Button>) : <span />}
            <Button onClick={() => close(false)}>Got it</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Sidebar / Profile entry: a sparkle that shimmers until the latest release has been read, then goes grey like its neighbours. */
export function WhatsNewButton({ unseen, collapsed, variant = "sidebar" }: { unseen: boolean; collapsed?: boolean; variant?: "sidebar" | "row" }) {
  if (variant === "row") {
    return (
      <button type="button" onClick={openWhatsNew} className="flex h-14 w-full items-center gap-4 px-4 text-left text-sm hover:bg-subtle">
        <Icon name="auto_awesome" fill={unseen} className={cn(unseen && "shimmer text-brand")} /><span className="flex-1 font-medium">What&apos;s new</span>{unseen && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-foreground">New</span>}<Icon name="chevron_right" className="text-muted-foreground" />
      </button>
    );
  }
  return (
    <button type="button" onClick={openWhatsNew} title={collapsed ? "What's new" : undefined}
      className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", unseen ? "text-foreground" : "text-muted-foreground", collapsed ? "w-10 justify-center px-0" : "w-full")}>
      <Icon name="auto_awesome" size={20} fill={unseen} className={cn(unseen && "shimmer text-brand")} />
      {!collapsed && <span className={cn(unseen && "shimmer-text")}>What&apos;s new</span>}
    </button>
  );
}

function fmtDate(id: string) { return new Date(`${id}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
