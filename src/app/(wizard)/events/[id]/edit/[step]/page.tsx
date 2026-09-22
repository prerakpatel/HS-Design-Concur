import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { requireActiveUser, initials } from "@/lib/auth";
import { updateBasics, saveBrief, saveFormats, saveAssign, publishEvent, deleteEvent, type WizardStep } from "@/app/actions/events";
import { WizardShell, STEPS } from "@/components/wizard/wizard-shell";
import { BasicsForm, BriefForm, FormatsForm, AssignForm, ReviewPanel } from "@/components/wizard/steps";
import { formatSize } from "@/lib/labels";
import { EVENT_CAP } from "@/config/limits";
import type { AppUser, Brief, EventRow, Format, Slot } from "@/lib/types";
import { wizardStatus } from "@/lib/wizard-status";

export default async function EditEventPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  if (!STEPS.some((s) => s.key === step)) notFound();
  const s = step as WizardStep;
  const { supabase, org, user } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  if (s === "brief" && event.brief_locked_at) redirect(`/events/${id}/edit/formats`);
  const [{ data: briefRow }, { data: requestedSlots }] = await Promise.all([
    supabase.from("briefs").select("description,time_text,venue_name").eq("event_id", id).maybeSingle<Pick<Brief, "description" | "time_text" | "venue_name">>(),
    supabase.from("slots").select("assignee_id,is_primary").eq("event_id", id).eq("requested", true),
  ]);
  const { statuses, issues } = wizardStatus({ title: event.title, eventDate: event.event_date, brief: briefRow, requestedSlots: requestedSlots ?? [] });

  if (s === "basics") return (
    <WizardShell eventId={id} step={s} statuses={statuses} title="Tell us the basics" subtitle="Anyone in the org can pick this up later if you save and exit.">
      <BasicsForm eventId={id} orgName={org.name} values={{ title: event.title, event_date: event.event_date ?? "", venue: event.venue ?? "" }} action={updateBasics.bind(null, id)} />
    </WizardShell>
  );

  if (s === "brief") {
    const { data: brief } = await supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<Brief>();
    return (
      <WizardShell eventId={id} step={s} statuses={statuses} title="What goes on the designs?" subtitle="Exactly the words the designers will place: when, the invite text and where. It locks at the first upload; changes then go through comments.">
        <BriefForm eventId={id} values={{ event_date: event.event_date ?? "", time_text: brief?.time_text ?? "", description: brief?.description ?? "", venue_name: brief?.venue_name ?? event.venue ?? "", venue_address: brief?.venue_address ?? "", notes: brief?.notes ?? "" }} action={saveBrief.bind(null, id)} />
      </WizardShell>
    );
  }

  if (s === "formats") {
    const [{ data: slots }, { data: formats }] = await Promise.all([
      supabase.from("slots").select("*").eq("event_id", id).returns<Slot[]>(),
      supabase.from("formats").select("*").eq("active", true).order("sort").returns<Format[]>(),
    ]);
    const byFormat = new Map((slots ?? []).map((sl) => [sl.format_id, sl]));
    const rows = (formats ?? []).flatMap((f) => { const sl = byFormat.get(f.id); return sl ? [{ slotId: sl.id, name: f.name, size: formatSize(f, { w: sl.custom_w, h: sl.custom_h }), kind: f.class, requested: sl.requested, isPrimary: sl.is_primary, notes: sl.notes ?? "", customSize: f.allow_custom_size, w: sl.custom_w, h: sl.custom_h }] : []; });
    return (
      <WizardShell eventId={id} step={s} statuses={statuses} title="Which formats does this event need?" subtitle="Mark the rest N/A. You can change this any time from the event page." wide>
        <FormatsForm eventId={id} rows={rows} action={saveFormats.bind(null, id)} />
      </WizardShell>
    );
  }

  if (s === "assign") {
    const [{ data: slots }, { data: members }] = await Promise.all([
      supabase.from("slots").select("*,formats(name,sort)").eq("event_id", id).eq("requested", true),
      supabase.from("users").select("id,name,email,function_tags,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id).order("name"),
    ]);
    const people = ((members ?? []) as unknown as Pick<AppUser, "id" | "name" | "email" | "function_tags">[]).sort((a, b) => Number(b.function_tags.includes("designer")) - Number(a.function_tags.includes("designer"))).map((p) => ({ id: p.id, label: `${p.name ?? p.email}${p.function_tags.includes("designer") ? " · Designer" : ""}` }));
    const rows = (slots ?? []).sort((a, b) => ((a.formats as unknown as { sort: number })?.sort ?? 0) - ((b.formats as unknown as { sort: number })?.sort ?? 0)).map((sl) => ({ slotId: sl.id, name: (sl.formats as unknown as { name: string })?.name ?? "", assignee: sl.assignee_id ?? "", due: sl.due_on ?? "" }));
    return (
      <WizardShell eventId={id} step={s} statuses={statuses} title="Who designs what, and by when?" subtitle="Designers are listed first. Due dates send a reminder three days before and on the day." wide>
        <AssignForm eventId={id} rows={rows} people={people} action={saveAssign.bind(null, id)} />
      </WizardShell>
    );
  }

  const brief = briefRow;
  const [{ data: slots }, { count }] = await Promise.all([
    supabase.from("slots").select("*,formats(name),users:assignee_id(name,email)").eq("event_id", id).eq("requested", true),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
  ]);
  const allIssues = event.status === "draft" && (count ?? 0) >= EVENT_CAP ? [...issues, { text: `All ${EVENT_CAP} event slots are in use; publishing is blocked until one frees up.`, step: "basics" as const, blocking: true }] : issues;
  return (
    <WizardShell eventId={id} step={s} statuses={statuses} title={event.status === "draft" ? "Ready to publish?" : "Review"} subtitle={event.status === "draft" ? "Publishing takes one of the shared event slots and notifies the assigned designers." : "This event is live. Changes in the earlier steps are saved as you go."}>
      <ReviewPanel eventId={id} isDraft={event.status === "draft"} canDelete={user.role === "core_admin" || event.created_by === user.id} issues={allIssues}
        summary={{ title: event.title, when: [event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "—", brief?.time_text?.split("\n")[0]].filter(Boolean).join(" · "), venue: brief?.venue_name ?? event.venue ?? "—", brief: brief?.description ?? null }}
        slots={(slots ?? []).map((sl) => { const who = sl.users as unknown as { name: string | null; email: string } | null; return { name: (sl.formats as unknown as { name: string })?.name ?? "", assignee: who ? { name: who.name ?? who.email, initials: initials(who.name, who.email) } : null, due: sl.due_on }; })}
        publish={async () => { "use server"; await publishEvent(id); }} remove={async () => { "use server"; await deleteEvent(id); }} />
    </WizardShell>
  );
}
