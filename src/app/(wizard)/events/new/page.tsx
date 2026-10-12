import { todayIso } from "@/lib/time";
import { requireActiveUser } from "@/lib/auth";
import { capFor } from "@/lib/project";
import { createDraftEvent, createDraftAssets } from "@/app/actions/events";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { EventForm, AssetsBriefForm } from "@/components/wizard/steps";
import { assetEndMax } from "@/lib/project";
import { DEFAULT_VENUE } from "@/config/orgs";

export const metadata = { title: "New request" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { supabase, org } = await requireActiveUser();
  const assets = (await searchParams).kind === "assets" && !!org.asset_requests;
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null);
  const full = (count ?? 0) >= capFor(org);
  const fullNote = full ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-text">All {capFor(org)} project slots are in use. You can save a draft, but it cannot be published until one frees up.</p> : null;
  if (assets) return (
    <WizardShell assets eventId={null} step="event" title="What do you need?" subtitle="Assets that aren't tied to an event: thumbnails, covers, presets. Describe them here; list each one on the next step.">
      <AssetsBriefForm eventId={null} orgName={org.name} values={{ title: "", event_date: "", description: "", notes: "" }} action={createDraftAssets} notice={fullNote} minDate={todayIso()} maxDate={assetEndMax()} />
    </WizardShell>
  );
  return (
    <WizardShell eventId={null} step="event" title="Tell us about the event" subtitle={`The basics and the words that go on the designs. Anyone in ${org.name} can pick this up later if you save and exit.`}>
      <EventForm eventId={null} orgName={org.name} values={{ title: "", event_date: "", time_text: "", description: "", venue_name: DEFAULT_VENUE.name, venue_address: DEFAULT_VENUE.address, notes: "" }} action={createDraftEvent}
        notice={full ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-text">All {capFor(org)} project slots are in use. You can save a draft, but it cannot be published until an older event is archived.</p> : null} />
    </WizardShell>
  );
}
