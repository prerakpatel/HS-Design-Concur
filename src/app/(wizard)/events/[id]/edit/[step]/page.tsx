import { notFound, redirect } from "next/navigation";
import { capFor, isAssets, slotName, assetEndMax, byFormatThenLabel } from "@/lib/project";
import { format } from "date-fns";
import { requireActiveUser, initials } from "@/lib/auth";
import { saveEvent, saveFormats, saveAssign, publishEvent, deleteEvent, saveAssetsBrief, saveAssetItems, type WizardStep } from "@/app/actions/events";
import { WizardShell, STEPS } from "@/components/wizard/wizard-shell";
import { EventForm, FormatsForm, AssignForm, ReviewPanel, AssetsBriefForm, AssetItemsForm } from "@/components/wizard/steps";
import { DEFAULT_VENUE } from "@/config/orgs";
import { formatSize } from "@/lib/labels";
import type { AppUser, Brief, EventRow, Format, Slot } from "@/lib/types";
import { wizardStatus } from "@/lib/wizard-status";

export default async function EditEventPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  if (step === "basics" || step === "brief") redirect(`/events/${id}/edit/event`); // the two old screens are one now
  if (!STEPS.some((s) => s.key === step)) notFound();
  const s = step as WizardStep;
  const { supabase, org, user } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const [{ data: briefRow }, { data: requestedSlots }] = await Promise.all([
    supabase.from("briefs").select("description,time_text,venue_name").eq("event_id", id).maybeSingle<Pick<Brief, "description" | "time_text" | "venue_name">>(),
    supabase.from("slots").select("assignee_id,is_primary").eq("event_id", id).eq("requested", true),
  ]);
  const assets = isAssets(event);
  const { statuses, issues } = wizardStatus({ title: event.title, eventDate: event.event_date, brief: briefRow, requestedSlots: requestedSlots ?? [], assets });

  if (assets && s === "event") {
    const { data: brief } = await supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<Brief>();
    return (
      <WizardShell assets eventId={id} step={s} statuses={statuses} title="What do you need?" subtitle="Describe the assets; list each one on the next step.">
        <AssetsBriefForm eventId={id} orgName={org.name} locked={!!event.brief_locked_at} action={saveAssetsBrief.bind(null, id)} minDate={new Date().toLocaleDateString("en-CA")} maxDate={assetEndMax()}
          values={{ title: event.title, event_date: event.event_date ?? "", description: brief?.description ?? "", notes: brief?.notes ?? "" }} />
      </WizardShell>
    );
  }

  if (assets && s === "formats") {
    const [{ data: slots }, { data: formats }] = await Promise.all([
      supabase.from("slots").select("*,versions(id),formats(sort)").eq("event_id", id).returns<(Slot & { versions: { id: string }[]; formats: { sort: number } | null })[]>(),
      supabase.from("formats").select("*").order("sort").returns<Format[]>(),
    ]);
    const used = new Set((slots ?? []).map((sl) => sl.format_id));
    const options = (formats ?? []).filter((f) => f.active || used.has(f.id)).map((f) => ({ id: f.id, name: f.name, size: formatSize(f), customSize: f.allow_custom_size }));
    const items = [...(slots ?? [])].map((sl) => ({ ...sl, sort: sl.formats?.sort ?? 0 })).sort(byFormatThenLabel)
      .map((sl) => ({ slotId: sl.id, formatId: sl.format_id, label: sl.label ?? "", notes: sl.notes ?? "", w: sl.custom_w, h: sl.custom_h, locked: (sl.versions?.length ?? 0) > 0 }));
    return (
      <WizardShell assets eventId={id} step={s} statuses={statuses} title="Which assets?" subtitle="Pick a format and how many, then name each one. Every asset gets its own designer, review and approval." wide>
        <AssetItemsForm eventId={id} formats={options} items={items} action={saveAssetItems.bind(null, id)} />
      </WizardShell>
    );
  }

  if (s === "event") {
    const { data: brief } = await supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<Brief>();
    return (
      <WizardShell eventId={id} step={s} statuses={statuses} title="Tell us about the event" subtitle="The basics and exactly the words the designers will place. The words lock at the first upload; changes then go through comments.">
        <EventForm eventId={id} orgName={org.name} locked={!!event.brief_locked_at} action={saveEvent.bind(null, id)}
          values={{ title: event.title, event_date: event.event_date ?? "", time_text: brief?.time_text ?? "", description: brief?.description ?? "", venue_name: brief?.venue_name ?? event.venue ?? DEFAULT_VENUE.name, venue_address: brief?.venue_address ?? DEFAULT_VENUE.address, notes: brief?.notes ?? "" }} />
      </WizardShell>
    );
  }

  if (s === "formats") {
    const [{ data: slots }, { data: formats }] = await Promise.all([
      supabase.from("slots").select("*,versions(id)").eq("event_id", id).returns<(Slot & { versions: { id: string }[] })[]>(),
      supabase.from("formats").select("*").eq("active", true).order("sort").returns<Format[]>(),
    ]);
    const byFormat = new Map((slots ?? []).map((sl) => [sl.format_id, sl]));
    const rows = (formats ?? []).flatMap((f) => { const sl = byFormat.get(f.id); return sl ? [{ slotId: sl.id, name: f.name, size: formatSize(f, { w: sl.custom_w, h: sl.custom_h }), kind: f.class, requested: sl.requested, isPrimary: sl.is_primary, notes: sl.notes ?? "", customSize: f.allow_custom_size, w: sl.custom_w, h: sl.custom_h, hasVersions: (sl.versions?.length ?? 0) > 0 }] : []; });
    return (
      <WizardShell eventId={id} step={s} statuses={statuses} title="Which formats does this event need?" subtitle="All formats start off. Turn on the ones you need; you can change this any time from the event page." wide>
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
    const rows = (slots ?? []).map((sl) => ({ ...sl, sort: (sl.formats as unknown as { sort: number })?.sort ?? 0 })).sort(byFormatThenLabel).map((sl) => ({ slotId: sl.id, name: slotName((sl.formats as unknown as { name: string })?.name, sl.label), assignee: sl.assignee_id ?? "", due: sl.due_on ?? "" }));
    return (
      <WizardShell assets={assets} eventId={id} step={s} statuses={statuses} title="Who designs what, and by when?" subtitle="Designers are listed first. Due dates send a reminder three days before and on the day." wide>
        <AssignForm eventId={id} rows={rows} people={people} action={saveAssign.bind(null, id)} />
      </WizardShell>
    );
  }

  const brief = briefRow;
  const [{ data: slots }, { count }] = await Promise.all([
    supabase.from("slots").select("*,formats(name,sort),users:assignee_id(name,email)").eq("event_id", id).eq("requested", true),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null),
  ]);
  const allIssues = event.status === "draft" && (count ?? 0) >= capFor(org) ? [...issues, { text: `All ${capFor(org)} project slots are in use; publishing is blocked until one frees up.`, step: "event" as const, blocking: true }] : issues;
  return (
    <WizardShell assets={assets} eventId={id} step={s} statuses={statuses} title={event.status === "draft" ? "Ready to publish?" : "Review"} subtitle={event.status === "draft" ? `Publishing takes one of ${org.short_name}'s project slots and notifies the assigned designers.` : "This is live. Changes in the earlier steps are saved as you go."}>
      <ReviewPanel assets={assets} eventId={id} isDraft={event.status === "draft"} canDelete={user.role === "core_admin" || event.created_by === user.id} issues={allIssues}
        summary={assets
          ? { title: event.title, when: event.event_date ? `Ends ${format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy")}; files are cleared the day after` : "—", venue: "Assets only", brief: brief?.description ?? null }
          : { title: event.title, when: [event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "—", brief?.time_text?.split("\n")[0]].filter(Boolean).join(" · "), venue: brief?.venue_name ?? event.venue ?? "—", brief: brief?.description ?? null }}
        slots={(slots ?? []).map((sl) => ({ ...sl, sort: (sl.formats as unknown as { sort: number })?.sort ?? 0 })).sort(byFormatThenLabel).map((sl) => { const who = sl.users as unknown as { name: string | null; email: string } | null; return { name: slotName((sl.formats as unknown as { name: string })?.name, sl.label), assignee: who ? { name: who.name ?? who.email, initials: initials(who.name, who.email) } : null, due: sl.due_on }; })}
        publish={async () => { "use server"; await publishEvent(id); }} remove={async () => { "use server"; await deleteEvent(id); }} />
    </WizardShell>
  );
}
