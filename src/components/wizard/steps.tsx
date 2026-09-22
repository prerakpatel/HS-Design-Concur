import Link from "next/link";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { DateField } from "@/components/ui/date-field";
import { WizardFooter, STEPS } from "@/components/wizard/wizard-shell";
import type { WizardIssue } from "@/lib/wizard-status";
import { ConfirmButton } from "@/components/confirm-button";

type Action = (formData: FormData) => Promise<void>;
export const field = "space-y-2";

export function BasicsForm({ eventId, orgName, values, action, notice }: { eventId: string | null; orgName: string; notice?: React.ReactNode; values: { title: string; event_date: string; venue: string }; action: Action }) {
  return (
    <form action={action} className="mx-auto max-w-[520px] space-y-6">
      <p className="text-center text-sm text-muted-foreground">Creating for <span className="font-medium text-foreground">{orgName}</span></p>
      {notice}
      <div className={field}><Label htmlFor="title">Event title</Label><Input id="title" name="title" required defaultValue={values.title} placeholder="Sharad Purnima" /></div>
      <div className={field}><Label htmlFor="event_date">Event date</Label><Input id="event_date" name="event_date" type="date" defaultValue={values.event_date} /><p className="text-sm text-muted-foreground">Multi-day festivals use the last day. Timings for each session go in the brief.</p></div>
      <div className={field}><Label htmlFor="venue">Venue</Label><Input id="venue" name="venue" defaultValue={values.venue} placeholder="Main Hall" /></div>
      <WizardFooter eventId={eventId} step="basics" />
    </form>
  );
}

export interface BriefValues { event_date: string; time_text: string; timing_note: string; description: string; venue_name: string; venue_address: string; notes: string }
/** The brief is exactly what goes on the designs: when, the invite text, where. */
export function BriefForm({ eventId, values, action }: { eventId: string; values: BriefValues; action: Action }) {
  const group = "space-y-5 rounded-2xl border border-border p-5";
  const legend = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <form action={action} className="space-y-6">
      <section className={group}>
        <p className={legend}>When</p>
        <div className={field}><Label htmlFor="event_date">Date</Label><DateField id="event_date" name="event_date" defaultValue={values.event_date} /></div>
        <div className={field}><Label htmlFor="time_text">Time</Label><Input id="time_text" name="time_text" defaultValue={values.time_text} placeholder="10:30 AM EST onwards" /><p className="text-sm text-muted-foreground">Written exactly as it should appear on the design.</p></div>
        <div className={field}><Label htmlFor="timing_note">Timing note</Label><Input id="timing_note" name="timing_note" defaultValue={values.timing_note} placeholder="Followed by Aarti and Mahaprasad" /></div>
      </section>
      <section className={group}>
        <p className={legend}>Invite text</p>
        <div className={field}><Label htmlFor="description" className="sr-only">Invite text</Label><Textarea id="description" name="description" rows={7} defaultValue={values.description} placeholder="The words that go on the invite: who is invited, what the occasion is, what to highlight…" /></div>
      </section>
      <section className={group}>
        <p className={legend}>Where</p>
        <div className={field}><Label htmlFor="venue_name">Venue name</Label><Input id="venue_name" name="venue_name" defaultValue={values.venue_name} placeholder="Harisumiran Mandir" /></div>
        <div className={field}><Label htmlFor="venue_address">Address</Label><Textarea id="venue_address" name="venue_address" rows={2} defaultValue={values.venue_address} placeholder="1 Temple Way, Edison, NJ 08817" /></div>
      </section>
      <div className={field}><Label htmlFor="notes">Anything else for the designers <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="notes" name="notes" rows={2} defaultValue={values.notes} placeholder="Sponsor line, language, colours to avoid…" /></div>
      <WizardFooter eventId={eventId} step="brief" />
    </form>
  );
}

export interface FormatRow { slotId: string; name: string; size: string; kind: string; requested: boolean; notes: string; customSize: boolean; w: number | null; h: number | null }
export function FormatsForm({ eventId, rows, action }: { eventId: string; rows: FormatRow[]; action: Action }) {
  return (
    <form action={action}>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.slotId} className="py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 pt-1"><p className="text-sm font-medium">{r.name}</p><p className="mt-0.5 text-sm text-muted-foreground">{r.size} · {r.kind}</p></div>
              <ChoiceChips name={`req_${r.slotId}`} size="sm" className="shrink-0 flex-nowrap" defaultValue={r.requested ? "on" : "off"} options={[{ value: "on", label: "Requested" }, { value: "off", label: "N/A" }]} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input name={`notes_${r.slotId}`} defaultValue={r.notes} placeholder="Notes for this format (optional)" className="h-11 min-w-0 basis-full text-sm sm:basis-0 sm:flex-1" />
              {r.customSize && <><Input name={`w_${r.slotId}`} type="number" defaultValue={r.w ?? ""} placeholder="Width px" aria-label="Width in pixels" className="h-11 w-[calc(50%-4px)] text-sm sm:w-32" /><Input name={`h_${r.slotId}`} type="number" defaultValue={r.h ?? ""} placeholder="Height px" aria-label="Height in pixels" className="h-11 w-[calc(50%-4px)] text-sm sm:w-32" /></>}
            </div>
          </li>
        ))}
      </ul>
      <WizardFooter eventId={eventId} step="formats" />
    </form>
  );
}

export interface AssignRow { slotId: string; name: string; assignee: string; due: string }
export interface Person { id: string; label: string }
export function AssignForm({ eventId, rows, people, action }: { eventId: string; rows: AssignRow[]; people: Person[]; action: Action }) {
  return (
    <form action={action}>
      {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">No formats are requested yet. Go back to Formats.</p> : (
        <ul className="divide-y divide-border">
          <li className="hidden grid-cols-[1fr_240px_180px] gap-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid"><span>Format</span><span>Designer</span><span>Due</span></li>
          {rows.map((r) => (
            <li key={r.slotId} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_240px_180px] md:items-center md:gap-4">
              <p className="text-sm font-medium">{r.name}</p>
              <SelectField name={`assignee_${r.slotId}`} defaultValue={r.assignee}><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</SelectField>
              <Input name={`due_${r.slotId}`} type="date" defaultValue={r.due} />
            </li>
          ))}
        </ul>
      )}
      <WizardFooter eventId={eventId} step="assign" />
    </form>
  );
}

export function ReviewPanel({ eventId, summary, slots, issues, isDraft, canDelete, publish, remove }: {
  eventId: string; summary: { title: string; when: string; venue: string; brief: string | null }; slots: { name: string; assignee: { name: string; initials: string } | null; due: string | null }[]; issues: WizardIssue[]; isDraft: boolean; canDelete: boolean;
  publish: () => Promise<void>; remove: () => Promise<void>;
}) {
  const blocking = issues.filter((i) => i.blocking); const hints = issues.filter((i) => !i.blocking);
  const edit = (step: string, label = "Edit") => <Link href={`/events/${eventId}/edit/${step}`} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{label}</Link>;
  return (
    <div className="space-y-8">
      {blocking.length > 0 && (
        <ul className="space-y-2 rounded-2xl bg-warning-soft p-5 text-sm text-warning-text">
          <li className="font-medium">Before this can be published</li>
          {blocking.map((p) => <li key={p.text} className="flex items-center justify-between gap-3"><span>{p.text}</span><Link href={`/events/${eventId}/edit/${p.step}`} className="shrink-0 font-medium underline-offset-4 hover:underline">Fix in {STEPS.find((x) => x.key === p.step)?.label}</Link></li>)}
        </ul>
      )}
      {hints.length > 0 && (
        <ul className="space-y-2 rounded-2xl bg-subtle p-5 text-sm text-muted-foreground">
          <li className="font-medium text-foreground">Worth a look, not blocking</li>
          {hints.map((p) => <li key={p.text} className="flex items-center justify-between gap-3"><span>{p.text}</span><Link href={`/events/${eventId}/edit/${p.step}`} className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline">Fix in {STEPS.find((x) => x.key === p.step)?.label}</Link></li>)}
        </ul>
      )}
      <dl className="grid grid-cols-1 gap-5 rounded-2xl bg-subtle p-6 text-sm md:grid-cols-2">
        <div><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Event {edit("basics")}</dt><dd className="mt-1 font-medium">{summary.title}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">When · where {edit("brief")}</dt><dd className="mt-1">{summary.when} · {summary.venue}</dd></div>
        <div className="md:col-span-2"><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Invite text {edit("brief")}</dt><dd className="mt-1 whitespace-pre-wrap leading-6">{summary.brief ?? <Link href={`/events/${eventId}/edit/brief`} className="text-warning-text underline-offset-4 hover:underline">Missing · add it in Brief</Link>}</dd></div>
      </dl>
      <div className="flex items-center justify-between px-1"><p className="text-sm font-medium">Formats and designers</p><span className="flex gap-3">{edit("formats", "Edit formats")}{edit("assign", "Edit designers")}</span></div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {slots.map((s, i) => <li key={i} className="flex items-center gap-4 px-5 py-4 text-sm"><span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>{s.assignee ? <span className="flex items-center gap-2 text-muted-foreground"><UserAvatar initials={s.assignee.initials} size={24} /><span className="hidden sm:inline">{s.assignee.name}</span></span> : <span className="text-muted-foreground">Unassigned</span>}<span className="w-20 text-right text-sm text-muted-foreground">{s.due ? format(new Date(s.due + "T00:00:00"), "d MMM") : ""}</span></li>)}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        {canDelete ? <ConfirmButton variant="ghost" action={remove} label={isDraft ? "Delete draft" : "Delete event"} title={`Delete “${summary.title}”?`} description="Core Admins can restore it for 7 days. Its files are removed after that." confirmLabel="Delete" /> : <span />}
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="lg"><Link href={`/events/${eventId}`}>Save and exit</Link></Button>
          {isDraft ? <form action={publish}><Button type="submit" size="lg" disabled={blocking.length > 0}>Publish event</Button></form> : <StateBadge state="approved" label="Live" className="h-9 px-3 text-sm" />}
        </div>
      </div>
    </div>
  );
}
