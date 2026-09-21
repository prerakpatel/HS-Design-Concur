"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { MONTHS_AHEAD } from "@/config/limits";

/** Wizard step 1. Creates a draft event; drafts do not count toward the cap. */
export async function createDraftEvent(formData: FormData) {
  const { supabase, user, org } = await requireActiveUser();
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "") || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  if (!title) throw new Error("Title is required");
  if (eventDate) {
    const max = new Date(); max.setMonth(max.getMonth() + MONTHS_AHEAD);
    if (new Date(eventDate) > max) throw new Error(`Events can be at most ${MONTHS_AHEAD} months out`);
  }
  const { data, error } = await supabase
    .from("events")
    .insert({ org_id: org.id, title, event_date: eventDate, venue, created_by: user.id, status: "draft" })
    .select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("briefs").insert({ event_id: data.id });
  const { data: formats } = await supabase.from("formats").select("id").eq("active", true);
  if (formats?.length) await supabase.from("slots").insert(formats.map((f) => ({ event_id: data.id, format_id: f.id, requested: true })));
  await supabase.from("activity").insert({ org_id: org.id, event_id: data.id, actor_id: user.id, kind: "event.created", payload: { title } });
  revalidatePath("/events");
  redirect(`/events/${data.id}`);
}
