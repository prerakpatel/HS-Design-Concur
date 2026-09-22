"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { EVENT_CAP, MONTHS_AHEAD } from "@/config/limits";
import { notify } from "@/lib/notify";

export type WizardStep = "basics" | "brief" | "formats" | "assign" | "review";
const ORDER: WizardStep[] = ["basics", "brief", "formats", "assign", "review"];
export async function nextStep(step: WizardStep): Promise<WizardStep> { return ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]; }

function horizonOk(eventDate: string | null) {
  if (!eventDate) return true;
  const max = new Date(); max.setMonth(max.getMonth() + MONTHS_AHEAD);
  return new Date(eventDate + "T00:00:00") <= max;
}

async function ownEvent(eventId: string, opts?: { allowArchived?: boolean }) {
  const ctx = await requireActiveUser();
  const { data: event } = await ctx.supabase.from("events").select("*").eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (!event || event.org_id !== ctx.org.id) throw new Error("Event not found in this organisation");
  if (event.status === "archived" && !opts?.allowArchived) throw new Error("Archived events are read-only");
  return { ...ctx, event };
}

function goto(eventId: string, formData: FormData, fallback: WizardStep) {
  const exit = formData.get("intent") === "exit";
  const next = String(formData.get("next") ?? fallback) as WizardStep;
  redirect(exit ? `/events/${eventId}` : `/events/${eventId}/edit/${next}`);
}

/** Wizard step 1. Creates a draft event; drafts do not count toward the cap. */
export async function createDraftEvent(formData: FormData) {
  const { supabase, user, org } = await requireActiveUser();
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "") || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  if (!title) throw new Error("Title is required");
  if (!horizonOk(eventDate)) throw new Error(`Events can be at most ${MONTHS_AHEAD} months out`);
  const { data, error } = await supabase.from("events").insert({ org_id: org.id, title, event_date: eventDate, venue, created_by: user.id, status: "draft" }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("briefs").insert({ event_id: data.id, venue_name: venue });
  const { data: formats } = await supabase.from("formats").select("id").eq("active", true);
  if (formats?.length) await supabase.from("slots").insert(formats.map((f) => ({ event_id: data.id, format_id: f.id, requested: true })));
  await supabase.from("activity").insert({ org_id: org.id, event_id: data.id, actor_id: user.id, kind: "event.created", payload: { title } });
  revalidatePath("/events");
  goto(data.id, formData, "brief");
}

export async function updateBasics(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "") || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  if (!title) throw new Error("Title is required");
  if (!horizonOk(eventDate)) throw new Error(`Events can be at most ${MONTHS_AHEAD} months out`);
  await supabase.from("events").update({ title, event_date: eventDate, venue, last_edited_at: new Date().toISOString() }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "brief");
}

export async function saveBrief(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  if (event.brief_locked_at) throw new Error("The brief is locked once a design has been uploaded. Use comments for changes.");
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const eventDate = str("event_date");
  if (!horizonOk(eventDate)) throw new Error(`Events can be at most ${MONTHS_AHEAD} months out`);
  const venue_name = str("venue_name");
  const { error } = await supabase.from("briefs").upsert({ event_id: event.id, description: str("description"), time_text: str("time_text"), venue_name, venue_address: str("venue_address"), notes: str("notes") });
  if (error) throw new Error(error.message);
  await supabase.from("events").update({ event_date: eventDate, venue: venue_name, last_edited_at: new Date().toISOString() }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "formats");
}

export async function saveFormats(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  const { data: slots } = await supabase.from("slots").select("id,format_id").eq("event_id", event.id);
  for (const s of slots ?? []) {
    const requested = formData.get(`req_${s.id}`) === "on";
    const notes = String(formData.get(`notes_${s.id}`) ?? "").trim() || null;
    const cw = Number(formData.get(`w_${s.id}`) || 0) || null;
    const ch = Number(formData.get(`h_${s.id}`) || 0) || null;
    await supabase.from("slots").update({ requested, notes, custom_w: cw, custom_h: ch, updated_at: new Date().toISOString() }).eq("id", s.id);
  }
  await supabase.from("events").update({ last_edited_at: new Date().toISOString() }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "assign");
}

export async function saveAssign(eventId: string, formData: FormData) {
  const { supabase, user, event } = await ownEvent(eventId);
  const { data: slots } = await supabase.from("slots").select("id,assignee_id,format_id,formats(name)").eq("event_id", event.id).eq("requested", true);
  const newlyAssigned: { userId: string; name: string }[] = [];
  for (const s of slots ?? []) {
    const assignee = String(formData.get(`assignee_${s.id}`) ?? "") || null;
    const due = String(formData.get(`due_${s.id}`) ?? "") || null;
    await supabase.from("slots").update({ assignee_id: assignee, due_on: due, updated_at: new Date().toISOString() }).eq("id", s.id);
    const fmt = s.formats as unknown as { name: string } | null;
    if (assignee && assignee !== s.assignee_id) newlyAssigned.push({ userId: assignee, name: fmt?.name ?? "a format" });
  }
  if (event.status === "active") for (const a of newlyAssigned) await notify(supabase, [a.userId], "slot.assigned", { eventId: event.id, title: event.title, format: a.name }, user.id);
  await supabase.from("events").update({ last_edited_at: new Date().toISOString() }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "review");
}

/** Step 5. Draft → active. Enforces the event cap and horizon (PRD §8). */
export async function publishEvent(eventId: string) {
  const { supabase, user, org, event } = await ownEvent(eventId);
  if (event.status !== "draft") redirect(`/events/${event.id}`);
  if (!event.event_date) throw new Error("Set the event date before publishing");
  if (!horizonOk(event.event_date)) throw new Error(`Events can be at most ${MONTHS_AHEAD} months out`);
  const { data: brief } = await supabase.from("briefs").select("description").eq("event_id", event.id).maybeSingle();
  if (!brief?.description) throw new Error("Add the brief before publishing");
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  if ((count ?? 0) >= EVENT_CAP) {
    const { data: oldest } = await supabase.from("events").select("title,event_date").eq("status", "active").is("deleted_at", null).order("event_date", { ascending: true }).limit(1).maybeSingle();
    throw new Error(`All ${EVENT_CAP} event slots are in use. The oldest active event is "${oldest?.title}" (${oldest?.event_date}); it frees a slot a week after its date.`);
  }
  await supabase.from("events").update({ status: "active", published_at: new Date().toISOString() }).eq("id", event.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, actor_id: user.id, kind: "event.published", payload: { title: event.title } });
  const { data: slots } = await supabase.from("slots").select("assignee_id").eq("event_id", event.id).eq("requested", true).not("assignee_id", "is", null);
  await notify(supabase, (slots ?? []).map((s) => s.assignee_id as string), "event.published", { eventId: event.id, title: event.title }, user.id);
  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

/** Creator may delete while nothing has been sent for review; Core Admins always (soft delete, PRD §8). */
export async function deleteEvent(eventId: string) {
  const { supabase, user, event } = await ownEvent(eventId, { allowArchived: true });
  const { error } = await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", event.id);
  if (error) throw new Error(error.message);
  await supabase.from("activity").insert({ org_id: event.org_id, event_id: event.id, actor_id: user.id, kind: "event.deleted", payload: { title: event.title } });
  revalidatePath("/events");
  redirect("/events");
}

export async function toggleSlotRequested(slotId: string, requested: boolean) {
  const { supabase } = await requireActiveUser();
  const { data: slot } = await supabase.from("slots").update({ requested, updated_at: new Date().toISOString() }).eq("id", slotId).select("event_id").single();
  if (slot) revalidatePath(`/events/${slot.event_id}`);
}
