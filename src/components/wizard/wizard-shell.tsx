import Link from "next/link";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import type { WizardStep } from "@/app/actions/events";

export const STEPS: { key: WizardStep; label: string }[] = [
  { key: "basics", label: "Basics" }, { key: "brief", label: "Brief" }, { key: "formats", label: "Formats" }, { key: "assign", label: "Assign" }, { key: "review", label: "Review" },
];

export function WizardShell({ eventId, step, title, subtitle, children }: { eventId: string; step: WizardStep; title: string; subtitle?: string; children: React.ReactNode }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="-mx-4 -my-6 flex min-h-dvh flex-col md:-mx-12 md:-my-10 md:flex-row">
      <aside className="hidden w-[200px] shrink-0 border-r border-border bg-subtle p-4 md:block">
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Event</p>
        <ol className="mt-3 space-y-1">
          {STEPS.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "active" : "todo";
            return (
              <li key={s.key}>
                <Link href={`/events/${eventId}/edit/${s.key}`} className={"flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm font-medium " + (state === "active" ? "bg-muted text-foreground" : state === "done" ? "text-foreground" : "text-muted-foreground")}>
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
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Button asChild variant="outline" size="icon"><Link href={`/events/${eventId}`} aria-label="Back to event"><Icon name="arrow_back" /></Link></Button>
          <p className="text-sm"><span className="font-medium">{STEPS[idx].label}</span> <span className="text-muted-foreground">Step {idx + 1} of {STEPS.length}</span></p>
          <Button asChild variant="outline"><Link href={`/events/${eventId}`}>Save and exit</Link></Button>
        </div>
        <div className="flex gap-1 px-4 md:hidden">{STEPS.map((s, i) => <span key={s.key} className={"h-[3px] flex-1 rounded-full " + (i <= idx ? "bg-primary" : "bg-muted-strong")} />)}</div>
        <div className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8 md:px-6">
          <div className="text-center"><h1 className="text-[30px] font-semibold leading-9 tracking-[-0.015em]">{title}</h1>{subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}</div>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function WizardFooter({ eventId, step, nextLabel = "Next" }: { eventId: string; step: WizardStep; nextLabel?: string }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  const prev = idx > 0 ? STEPS[idx - 1].key : null;
  const next = STEPS[Math.min(idx + 1, STEPS.length - 1)].key;
  return (
    <div className="sticky bottom-0 -mx-4 mt-8 flex items-center justify-between border-t border-border bg-card px-4 py-3 md:-mx-6 md:px-6">
      <input type="hidden" name="next" value={next} />
      {prev ? <Button asChild variant="ghost" size="lg"><Link href={`/events/${eventId}/edit/${prev}`}>Back</Link></Button> : <span />}
      <div className="flex gap-2">
        <Button type="submit" name="intent" value="exit" variant="secondary" size="lg">Save and exit</Button>
        <Button type="submit" name="intent" value="next" size="lg" className="h-11 rounded-[10px] px-5">{nextLabel}</Button>
      </div>
    </div>
  );
}
