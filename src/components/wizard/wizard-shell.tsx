import Link from "next/link";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import type { WizardStep } from "@/app/actions/events";

export const STEPS: { key: WizardStep; label: string }[] = [
  { key: "basics", label: "Basics" }, { key: "brief", label: "Brief" }, { key: "formats", label: "Formats" }, { key: "assign", label: "Assign" }, { key: "review", label: "Review" },
];

/** Focused full-screen flow (no app sidebar or tab bar), like a host-onboarding wizard. `eventId` is null before the draft exists. */
export function WizardShell({ eventId, step, title, subtitle, children, wide }: { eventId: string | null; step: WizardStep; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex min-h-dvh flex-col bg-card md:flex-row">
      <aside className="hidden w-[220px] shrink-0 border-r border-border bg-subtle p-5 md:block">
        <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">New event</p>
        <ol className="mt-3 space-y-1">
          {STEPS.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "active" : "todo";
            return (
              <li key={s.key}>
                <Link href={eventId ? `/events/${eventId}/edit/${s.key}` : "#"} aria-disabled={!eventId} className={"flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium " + (state === "active" ? "bg-muted text-foreground" : state === "done" ? "text-foreground" : "text-muted-foreground") + (eventId ? "" : " pointer-events-none")}>
                  <span className={"flex size-6 items-center justify-center rounded-full text-xs " + (state === "active" ? "bg-primary text-primary-foreground" : state === "done" ? "bg-success-soft text-success-text" : "border border-border")}>
                    {state === "done" ? <Icon name="check" className="!text-[14px]" /> : i + 1}
                  </span>
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ol>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-4 md:px-8">
          <Button asChild variant="outline" size="icon-sm"><Link href={eventId ? `/events/${eventId}` : "/events"} aria-label={eventId ? "Back to event" : "Back to events"}><Icon name="arrow_back" /></Link></Button>
          <p className="text-sm"><span className="font-medium">{STEPS[idx].label}</span> <span className="text-muted-foreground">· Step {idx + 1} of {STEPS.length}</span></p>
          {eventId ? <Button asChild variant="outline"><Link href={`/events/${eventId}`}>Save and exit</Link></Button> : <Button asChild variant="ghost"><Link href="/events">Cancel</Link></Button>}
        </div>
        <div className="flex gap-1 px-4 md:hidden">{STEPS.map((s, i) => <span key={s.key} className={"h-[3px] flex-1 rounded-full " + (i <= idx ? "bg-primary" : "bg-muted-strong")} />)}</div>
        <div className={"mx-auto w-full flex-1 px-5 pb-32 pt-6 md:px-8 md:pt-10 " + (wide ? "max-w-[820px]" : "max-w-[640px]")}>
          <div className="text-center"><h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] md:text-[28px] md:leading-9">{title}</h1>{subtitle && <p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-muted-foreground">{subtitle}</p>}</div>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function WizardFooter({ eventId, step, nextLabel = "Next" }: { eventId: string | null; step: WizardStep; nextLabel?: string }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  const prev = idx > 0 ? STEPS[idx - 1].key : null;
  const next = STEPS[Math.min(idx + 1, STEPS.length - 1)].key;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-border bg-card/95 px-5 py-4 backdrop-blur md:left-[220px] md:px-8">
      <input type="hidden" name="next" value={next} />
      {prev && eventId ? <Button asChild variant="ghost" size="lg"><Link href={`/events/${eventId}/edit/${prev}`}>Back</Link></Button> : <span />}
      <div className="flex gap-2">
        <Button type="submit" name="intent" value="exit" variant="secondary" size="lg">Save and exit</Button>
        <Button type="submit" name="intent" value="next" size="lg">{nextLabel}</Button>
      </div>
    </div>
  );
}
