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
    <div className="mx-auto max-w-[520px] space-y-10 py-4 md:py-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New event · Step 1 of 5</p>
        <h1 className="mt-3 text-[28px] font-semibold leading-9 tracking-[-0.02em] md:text-[34px] md:leading-[42px]">Tell us the basics</h1>
        <p className="mx-auto mt-3 max-w-[420px] text-[15px] leading-6 text-muted-foreground">Anyone in {org.name} can pick this up later if you save and exit.</p>
      </div>
      {full && <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-text">All {EVENT_CAP} event slots are in use. You can save a draft, but it cannot be published until an older event is archived.</p>}
      <form action={createDraftEvent} className="space-y-6">
        <div className="rounded-xl bg-muted p-1 text-center text-[15px] font-medium"><span className="block rounded-[10px] bg-card py-2.5 shadow-sm">{org.name}</span></div>
        <div className="space-y-2"><Label htmlFor="title">Event title</Label><Input id="title" name="title" required placeholder="Sharad Purnima" /></div>
        <div className="space-y-2"><Label htmlFor="event_date">Event date</Label><Input id="event_date" name="event_date" type="date" /></div>
        <div className="space-y-2"><Label htmlFor="venue">Venue</Label><Input id="venue" name="venue" placeholder="Main Hall" /></div>
        <div className="flex justify-end pt-2"><Button type="submit" size="lg">Next</Button></div>
      </form>
    </div>
  );
}
