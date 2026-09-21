import { requireActiveUser } from "@/lib/auth";
import { createDraftEvent } from "@/app/actions/events";
import { EVENT_CAP } from "@/config/limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  const { supabase, org } = await requireActiveUser();
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  const full = (count ?? 0) >= EVENT_CAP;
  return (
    <div className="mx-auto max-w-[480px] space-y-8 py-6">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New event · Step 1 of 5</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-9 tracking-[-0.015em]">Tell us the basics</h1>
        <p className="mt-2 text-sm text-muted-foreground">Anyone in {org.name} can pick this up later if you save and exit.</p>
      </div>
      {full && <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-text">All {EVENT_CAP} event slots are in use. You can save a draft, but it cannot be published until an older event is archived.</p>}
      <form action={createDraftEvent} className="space-y-4">
        <div className="rounded-[10px] bg-muted p-1 text-center text-sm font-medium"><span className="block rounded-[10px] bg-card py-2 shadow-sm">{org.name}</span></div>
        <div className="space-y-1.5"><Label htmlFor="title">Event title</Label><Input id="title" name="title" required placeholder="Sharad Purnima" /></div>
        <div className="space-y-1.5"><Label htmlFor="event_date">Event date</Label><Input id="event_date" name="event_date" type="date" /></div>
        <div className="space-y-1.5"><Label htmlFor="venue">Venue</Label><Input id="venue" name="venue" placeholder="Main Hall" /></div>
        <div className="flex justify-end pt-2"><Button type="submit" size="lg" className="h-11 rounded-[10px] px-5">Next</Button></div>
      </form>
    </div>
  );
}
