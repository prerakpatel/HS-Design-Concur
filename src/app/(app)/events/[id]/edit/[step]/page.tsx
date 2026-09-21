import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { requireActiveUser, initials } from "@/lib/auth";
import { updateBasics, saveBrief, saveFormats, saveAssign, publishEvent, deleteEvent, type WizardStep } from "@/app/actions/events";
import { WizardShell, WizardFooter, STEPS } from "@/components/wizard/wizard-shell";
import { TimingsEditor } from "@/components/wizard/timings-editor";
import { ConfirmButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { formatSize } from "@/lib/labels";
import { EVENT_CAP } from "@/config/limits";
import type { AppUser, EventRow, Format, Slot } from "@/lib/types";

export default async function EditEventPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  if (!STEPS.some((s) => s.key === step)) notFound();
  const s = step as WizardStep;
  const { supabase, org, user } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  if (s === "brief" && event.brief_locked_at) redirect(`/events/${id}/edit/formats`);

  if (s === "basics") {
    return (
      <WizardShell eventId={id} step={s} title="Tell us the basics" subtitle="Anyone in the org can pick this up later if you save and exit.">
        <form action={updateBasics.bind(null, id)} className="mx-auto max-w-[480px] space-y-4">
          <div className="rounded-[10px] bg-muted p-1 text-center text-sm font-medium"><span className="block rounded-[10px] bg-card py-2 shadow-sm">{org.name}</span></div>
          <div className="space-y-1.5"><Label htmlFor="title">Event title</Label><Input id="title" name="title" required defaultValue={event.title} /></div>
          <div className="space-y-1.5"><Label htmlFor="event_date">Event date</Label><Input id="event_date" name="event_date" type="date" defaultValue={event.event_date ?? ""} /></div>
          <div className="space-y-1.5"><Label htmlFor="venue">Venue</Label><Input id="venue" name="venue" defaultValue={event.venue ?? ""} /></div>
          <WizardFooter eventId={id} step={s} />
        </form>
      </WizardShell>
    );
  }

  if (s === "brief") {
    const [{ data: brief }, { data: timings }] = await Promise.all([
      supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<{ description: string | null; venue: string | null; notes: string | null }>(),
      supabase.from("brief_timings").select("*").eq("event_id", id).order("sort"),
    ]);
    return (
      <WizardShell eventId={id} step={s} title="What should the designs say?" subtitle="Publication or a Core Admin writes this once. After the first upload it locks and changes travel as comments.">
        <form action={saveBrief.bind(null, id)} className="space-y-6">
          <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={6} defaultValue={brief?.description ?? ""} placeholder="What the event is, who it is for, what to highlight…" /></div>
          <div className="space-y-2"><Label>Timings</Label><TimingsEditor initial={(timings ?? []).map((t) => ({ label: t.label ?? "", on_date: t.on_date ?? "", starts_at: (t.starts_at ?? "").slice(0, 5), ends_at: (t.ends_at ?? "").slice(0, 5) }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="venue">Venue (as it should appear on the design)</Label><Input id="venue" name="venue" defaultValue={brief?.venue ?? event.venue ?? ""} /></div>
          <div className="space-y-1.5"><Label htmlFor="notes">Notes for designers</Label><Textarea id="notes" name="notes" rows={3} defaultValue={brief?.notes ?? ""} placeholder="Sponsor line, language, colours to avoid…" /></div>
          <WizardFooter eventId={id} step={s} />
        </form>
      </WizardShell>
    );
  }

  if (s === "formats") {
    const [{ data: slots }, { data: formats }] = await Promise.all([
      supabase.from("slots").select("*").eq("event_id", id).returns<Slot[]>(),
      supabase.from("formats").select("*").eq("active", true).order("sort").returns<Format[]>(),
    ]);
    const byFormat = new Map((slots ?? []).map((sl) => [sl.format_id, sl]));
    return (
      <WizardShell eventId={id} step={s} title="Which formats does this event need?" subtitle="Mark the rest N/A. You can change this any time from the event page.">
        <form action={saveFormats.bind(null, id)}>
          <ul className="divide-y divide-border">
            {(formats ?? []).map((f) => { const sl = byFormat.get(f.id); if (!sl) return null; return (
              <li key={f.id} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0"><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{formatSize(f, { w: sl.custom_w, h: sl.custom_h })} · {f.class}</p></div>
                  <label className="flex cursor-pointer items-center rounded-full bg-muted p-1 text-xs font-medium">
                    <input type="checkbox" name={`req_${sl.id}`} defaultChecked={sl.requested} className="peer sr-only" />
                    <span className="rounded-full px-3 py-1 text-muted-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-sm">Requested</span>
                    <span className="rounded-full bg-card px-3 py-1 text-foreground shadow-sm peer-checked:bg-transparent peer-checked:text-muted-foreground peer-checked:shadow-none">N/A</span>
                  </label>
                </div>
                <div className="mt-2 flex gap-2">
                  <Input name={`notes_${sl.id}`} defaultValue={sl.notes ?? ""} placeholder="Notes for this format (optional)" className="h-9 text-sm" />
                  {f.allow_custom_size && <><Input name={`w_${sl.id}`} type="number" defaultValue={sl.custom_w ?? ""} placeholder="W px" className="h-9 w-24 text-sm" /><Input name={`h_${sl.id}`} type="number" defaultValue={sl.custom_h ?? ""} placeholder="H px" className="h-9 w-24 text-sm" /></>}
                </div>
              </li>
            ); })}
          </ul>
          <WizardFooter eventId={id} step={s} />
        </form>
      </WizardShell>
    );
  }

  if (s === "assign") {
    const [{ data: slots }, { data: members }] = await Promise.all([
      supabase.from("slots").select("*,formats(name,sort)").eq("event_id", id).eq("requested", true),
      supabase.from("users").select("id,name,email,function_tags,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id).order("name"),
    ]);
    const people = ((members ?? []) as unknown as Pick<AppUser, "id" | "name" | "email" | "function_tags">[]).sort((a, b) => Number(b.function_tags.includes("designer")) - Number(a.function_tags.includes("designer")));
    const rows = (slots ?? []).sort((a, b) => ((a.formats as unknown as { sort: number })?.sort ?? 0) - ((b.formats as unknown as { sort: number })?.sort ?? 0));
    return (
      <WizardShell eventId={id} step={s} title="Who designs what, and by when?" subtitle="Designers are listed first. Due dates send a reminder three days before and on the day.">
        <form action={saveAssign.bind(null, id)}>
          <ul className="divide-y divide-border">
            {rows.map((sl) => (
              <li key={sl.id} className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[1fr_220px_160px]">
                <p className="text-sm font-medium">{(sl.formats as unknown as { name: string })?.name}</p>
                <select name={`assignee_${sl.id}`} defaultValue={sl.assignee_id ?? ""} className="h-9 rounded-[10px] border border-input bg-card px-2 text-sm">
                  <option value="">Unassigned</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}{p.function_tags.includes("designer") ? " · Designer" : ""}</option>)}
                </select>
                <Input name={`due_${sl.id}`} type="date" defaultValue={sl.due_on ?? ""} className="h-9 text-sm" />
              </li>
            ))}
          </ul>
          {rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No formats are requested yet. Go back to Formats.</p>}
          <WizardFooter eventId={id} step={s} />
        </form>
      </WizardShell>
    );
  }

  // review
  const [{ data: brief }, { data: slots }, { count }] = await Promise.all([
    supabase.from("briefs").select("description").eq("event_id", id).maybeSingle<{ description: string | null }>(),
    supabase.from("slots").select("*,formats(name),users:assignee_id(name,email)").eq("event_id", id).eq("requested", true),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
  ]);
  const problems: string[] = [];
  if (!event.event_date) problems.push("Event date is missing (Basics).");
  if (!brief?.description) problems.push("The brief has no description (Brief).");
  if ((slots ?? []).length === 0) problems.push("No formats are requested (Formats).");
  const full = event.status === "draft" && (count ?? 0) >= EVENT_CAP;
  if (full) problems.push(`All ${EVENT_CAP} event slots are in use; publish is blocked until one frees up.`);
  const canDelete = user.role === "core_admin" || event.created_by === user.id;
  return (
    <WizardShell eventId={id} step={s} title={event.status === "draft" ? "Ready to publish?" : "Review"} subtitle={event.status === "draft" ? "Publishing takes one of the shared event slots and notifies the assigned designers." : "This event is live. Changes above are saved as you go."}>
      <div className="space-y-6">
        <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-subtle p-5 text-sm md:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase text-muted-foreground">Event</dt><dd className="mt-1 font-medium">{event.title}</dd></div>
          <div><dt className="text-xs font-medium uppercase text-muted-foreground">Date · venue</dt><dd className="mt-1">{event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "—"} · {event.venue ?? "—"}</dd></div>
          <div className="md:col-span-2"><dt className="text-xs font-medium uppercase text-muted-foreground">Brief</dt><dd className="mt-1 whitespace-pre-wrap">{brief?.description ?? <span className="text-muted-foreground">Missing</span>}</dd></div>
        </dl>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {(slots ?? []).map((sl) => { const who = sl.users as unknown as { name: string | null; email: string } | null; return (
            <li key={sl.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="flex-1 font-medium">{(sl.formats as unknown as { name: string })?.name}</span>{who ? <span className="flex items-center gap-2 text-muted-foreground"><UserAvatar initials={initials(who.name, who.email)} size={24} />{who.name ?? who.email}</span> : <span className="text-muted-foreground">Unassigned</span>}<span className="w-24 text-right text-xs text-muted-foreground">{sl.due_on ? format(new Date(sl.due_on + "T00:00:00"), "d MMM") : ""}</span></li>
          ); })}
        </ul>
        {problems.length > 0 && <ul className="space-y-1 rounded-xl bg-warning-soft p-4 text-sm text-warning-text">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canDelete ? <ConfirmButton variant="ghost" action={async () => { "use server"; await deleteEvent(id); }} label={event.status === "draft" ? "Delete draft" : "Delete event"} title={`Delete “${event.title}”?`} description="Core Admins can restore it for 7 days. Its files are removed after that." confirmLabel="Delete" /> : <span />}
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="lg"><a href={`/events/${id}`}>Save and exit</a></Button>
            {event.status === "draft" && <form action={publishEvent.bind(null, id)}><Button type="submit" size="lg" className="h-11 rounded-[10px] px-5" disabled={problems.length > 0}>Publish event</Button></form>}
            {event.status !== "draft" && <StateBadge state="approved" label="Live" />}
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
