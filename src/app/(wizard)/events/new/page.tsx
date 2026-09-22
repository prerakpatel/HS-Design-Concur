import { requireActiveUser } from "@/lib/auth";
import { createDraftEvent } from "@/app/actions/events";
import { EVENT_CAP } from "@/config/limits";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { BasicsForm } from "@/components/wizard/steps";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  const { supabase, org } = await requireActiveUser();
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  const full = (count ?? 0) >= EVENT_CAP;
  return (
    <WizardShell eventId={null} step="basics" title="Tell us the basics" subtitle={`Anyone in ${org.name} can pick this up later if you save and exit.`}>
      <BasicsForm eventId={null} orgName={org.name} values={{ title: "", event_date: "", venue: "" }} action={createDraftEvent}
        notice={full ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-text">All {EVENT_CAP} event slots are in use. You can save a draft, but it cannot be published until an older event is archived.</p> : null} />
    </WizardShell>
  );
}
