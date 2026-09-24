import { requireActiveUser } from "@/lib/auth";
import { createDraftEvent } from "@/app/actions/events";
import { EVENT_CAP } from "@/config/limits";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { EventForm } from "@/components/wizard/steps";
import { DEFAULT_VENUE } from "@/config/orgs";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  const { supabase, org } = await requireActiveUser();
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  const full = (count ?? 0) >= EVENT_CAP;
  return (
    <WizardShell eventId={null} step="event" title="Tell us about the event" subtitle={`The basics and the words that go on the designs. Anyone in ${org.name} can pick this up later if you save and exit.`}>
      <EventForm eventId={null} orgName={org.name} values={{ title: "", event_date: "", time_text: "", description: "", venue_name: DEFAULT_VENUE.name, venue_address: DEFAULT_VENUE.address, notes: "" }} action={createDraftEvent}
        notice={full ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-text">All {EVENT_CAP} event slots are in use. You can save a draft, but it cannot be published until an older event is archived.</p> : null} />
    </WizardShell>
  );
}
