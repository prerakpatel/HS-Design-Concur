"use server";
import { loadProjectPeople } from "@/lib/project-people";
import { todayIso } from "@/lib/time";
import { capFor, isAssets, slotName, assetEndMax } from "@/lib/project";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { MONTHS_AHEAD, ASSET_MAX_DAYS } from "@/config/limits";
import { notify } from "@/lib/notify";
import { UserError } from "@/lib/user-error";

export type WizardStep = "event" | "formats" | "assign" | "review";
const ORDER: WizardStep[] = ["event", "formats", "assign", "review"];
export async function nextStep(step: WizardStep): Promise<WizardStep> { return ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]; }

function horizonOk(eventDate: string | null) {
  if (!eventDate) return true;
  const max = new Date(); max.setMonth(max.getMonth() + MONTHS_AHEAD);
  return new Date(eventDate + "T00:00:00") <= max;
}

async function ownEvent(eventId: string, opts?: { allowArchived?: boolean }) {
  const ctx = await requireActiveUser();
  const { data: event } = await ctx.supabase.from("events").select("*").eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (!event || event.org_id !== ctx.org.id) throw new UserError("Event not found in this organization");
  if (event.status === "archived" && !opts?.allowArchived) throw new UserError("Archived events are read-only");
  return { ...ctx, event };
}

function goto(eventId: string, formData: FormData, fallback: WizardStep) {
  const exit = formData.get("intent") === "exit";
  const next = String(formData.get("next") ?? fallback) as WizardStep;
  redirect(exit ? `/events/${eventId}` : `/events/${eventId}/edit/${next}`);
}

/** Everything the Event step collects: title, date, timings, venue, invite text, designer notes. */
function readEventForm(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = str("event_date");
  if (!title) throw new UserError("Title is required");
  if (!horizonOk(eventDate)) throw new UserError(`Events can be at most ${MONTHS_AHEAD} months out`);
  return { title, eventDate, venue_name: str("venue_name"), venue_address: str("venue_address"), time_text: str("time_text"), description: str("description"), notes: str("notes") };
}

/** Wizard step 1 (Event). Creates the draft with its brief in one go; drafts do not count toward the cap. */
export async function createDraftEvent(formData: FormData) {
  const { supabase, user, org } = await requireActiveUser();
  const f = readEventForm(formData);
  const { data, error } = await supabase.from("events").insert({ org_id: org.id, title: f.title, event_date: f.eventDate, venue: f.venue_name, created_by: user.id, status: "draft" }).select("id").single();
  if (error) throw new UserError(error.message);
  await supabase.from("briefs").insert({ event_id: data.id, description: f.description, time_text: f.time_text, venue_name: f.venue_name, venue_address: f.venue_address, notes: f.notes });
  const { data: formats } = await supabase.from("formats").select("id").eq("active", true);
  // Every catalog format gets a slot, all off; the Formats step turns on the ones this event needs.
  if (formats?.length) await supabase.from("slots").insert(formats.map((fm) => ({ event_id: data.id, format_id: fm.id, requested: false })));
  await supabase.from("activity").insert({ org_id: org.id, event_id: data.id, actor_id: user.id, kind: "event.created", payload: { title: f.title } });
  revalidatePath("/events");
  goto(data.id, formData, "formats");
}

/**
 * Event step on an existing event. Once a design has been uploaded the brief is locked (PRD §6.1): title, date and
 * venue name may still change, the words on the design may not.
 */
export async function saveEvent(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  const f = readEventForm(formData);
  const locked = !!event.brief_locked_at;
  await supabase.from("events").update({ title: f.title, event_date: f.eventDate, venue: f.venue_name, last_edited_at: new Date().toISOString() }).eq("id", event.id);
  const briefPatch = locked ? { venue_name: f.venue_name } : { description: f.description, time_text: f.time_text, venue_name: f.venue_name, venue_address: f.venue_address, notes: f.notes };
  const { error } = await supabase.from("briefs").upsert({ event_id: event.id, ...briefPatch });
  if (error) throw new UserError(error.message);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "formats");
}

/** The Brief step of an assets-only request: what is needed, by when the project ends, notes. */
function readAssetsForm(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const endDate = str("event_date");
  if (!title) throw new UserError("Give the request a title");
  if (endDate && endDate < todayIso()) throw new UserError("The end date has already passed");
  if (endDate && endDate > assetEndMax()) throw new UserError(`An assets-only request ends at most ${ASSET_MAX_DAYS} days from today`);
  return { title, endDate, description: str("description"), notes: str("notes") };
}

/** New assets-only request (Harisumiran for now): a draft with its brief; items are added on the next step. */
export async function createDraftAssets(formData: FormData) {
  const { supabase, user, org } = await requireActiveUser();
  if (!org.asset_requests) throw new UserError(`${org.short_name} can only request designs for events right now`);
  const f = readAssetsForm(formData);
  const { data, error } = await supabase.from("events").insert({ org_id: org.id, kind: "assets", title: f.title, event_date: f.endDate, venue: null, created_by: user.id, status: "draft" }).select("id").single();
  if (error) throw new UserError(error.message);
  await supabase.from("briefs").insert({ event_id: data.id, description: f.description, notes: f.notes });
  await supabase.from("activity").insert({ org_id: org.id, event_id: data.id, actor_id: user.id, kind: "event.created", payload: { title: f.title } });
  revalidatePath("/events");
  goto(data.id, formData, "formats");
}

export async function saveAssetsBrief(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  const f = readAssetsForm(formData);
  await supabase.from("events").update({ title: f.title, event_date: f.endDate, last_edited_at: new Date().toISOString() }).eq("id", event.id);
  const { error } = await supabase.from("briefs").upsert({ event_id: event.id, ...(event.brief_locked_at ? {} : { description: f.description, notes: f.notes }) });
  if (error) throw new UserError(error.message);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "formats");
}

/**
 * The Assets step: the list of items, each a format plus an optional name ("March"), notes and, for
 * custom-size formats, a size. Items with designs can be renamed but not removed or moved to another format.
 */
export async function saveAssetItems(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  type Item = { slotId?: string; formatId: string; label: string; notes: string; w?: number | null; h?: number | null };
  let items: Item[] = [];
  try { items = JSON.parse(String(formData.get("items") ?? "[]")); } catch { throw new UserError("Could not read the list of assets"); }
  const { data: slots } = await supabase.from("slots").select("id,format_id,label,versions(id)").eq("event_id", event.id);
  const keep = new Set(items.map((i) => i.slotId).filter(Boolean));
  const now = new Date().toISOString();
  for (const s of slots ?? []) {
    if (keep.has(s.id)) continue;
    if ((s.versions?.length ?? 0) > 0) throw new UserError(`${s.label ? `“${s.label}”` : "An item"} already has designs, so it can't be removed`);
    const { error } = await supabase.from("slots").delete().eq("id", s.id); if (error) throw new UserError(error.message);
  }
  for (const it of items) {
    const row = { label: it.label.trim() || null, notes: it.notes.trim() || null, custom_w: it.w || null, custom_h: it.h || null, requested: true, updated_at: now };
    const existing = (slots ?? []).find((s) => s.id === it.slotId);
    if (existing) {
      const moved = existing.format_id !== it.formatId;
      if (moved && (existing.versions?.length ?? 0) > 0) throw new UserError("An item with designs can't change format; add a new item instead");
      const { error } = await supabase.from("slots").update({ ...row, ...(moved ? { format_id: it.formatId } : {}) }).eq("id", existing.id);
      if (error) throw new UserError(error.message);
    } else {
      const { error } = await supabase.from("slots").insert({ ...row, event_id: event.id, format_id: it.formatId });
      if (error) throw new UserError(error.code === "23505" ? "Two assets of the same format need different names (e.g. January, February)" : error.message);
    }
  }
  await supabase.from("events").update({ last_edited_at: now }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "assign");
}

export async function saveFormats(eventId: string, formData: FormData) {
  const { supabase, event } = await ownEvent(eventId);
  const { data: slots } = await supabase.from("slots").select("id,format_id,versions(id)").eq("event_id", event.id);
  const requestedIds = new Set<string>();
  let primary = String(formData.get("primary") ?? "");
  const fail = (e: { message: string } | null) => { if (e) throw new UserError(e.message); };

  // Print items: a size change on an item that already has designs moves them to the new size. The empty slot
  // of the new size is dropped, the old slot takes the new format, and a fresh (off) slot keeps the old size in
  // the catalog for this event. Only the print section posts print_orig_/print_pick_ pairs.
  for (let i = 0; formData.has(`print_pick_${i}`); i++) {
    const orig = String(formData.get(`print_orig_${i}`) ?? ""); const pick = String(formData.get(`print_pick_${i}`) ?? "");
    if (!pick) continue;
    if (orig && orig !== pick) {
      const from = (slots ?? []).find((s) => s.id === orig); const to = (slots ?? []).find((s) => s.id === pick);
      if (from && to && (from.versions?.length ?? 0) > 0) {
        if ((to.versions?.length ?? 0) > 0) throw new UserError("Both print sizes already have designs. Turn one off instead of changing its size.");
        fail((await supabase.from("slots").delete().eq("id", to.id)).error);
        fail((await supabase.from("slots").update({ format_id: to.format_id, updated_at: new Date().toISOString() }).eq("id", from.id)).error);
        fail((await supabase.from("slots").insert({ event_id: event.id, format_id: from.format_id, requested: false })).error);
        to.id = "__gone__"; requestedIds.add(from.id); if (primary === pick) primary = from.id;
        continue;
      }
    }
    requestedIds.add(pick);
  }
  const { data: fresh } = await supabase.from("slots").select("id,format_id").eq("event_id", event.id);
  for (const s of fresh ?? []) {
    const requested = requestedIds.has(s.id) || formData.get(`req_${s.id}`) === "on";
    const is_primary = requested && s.id === primary;
    const notes = formData.has(`notes_${s.id}`) ? String(formData.get(`notes_${s.id}`) ?? "").trim() || null : undefined;
    const cw = Number(formData.get(`w_${s.id}`) || 0) || null;
    const ch = Number(formData.get(`h_${s.id}`) || 0) || null;
    fail((await supabase.from("slots").update({ requested, ...(notes !== undefined ? { notes } : {}), custom_w: cw, custom_h: ch, is_primary: false, updated_at: new Date().toISOString() }).eq("id", s.id)).error);
    if (is_primary) fail((await supabase.from("slots").update({ is_primary: true }).eq("id", s.id)).error);
  }
  await supabase.from("events").update({ last_edited_at: new Date().toISOString() }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "assign");
}

export async function saveAssign(eventId: string, formData: FormData) {
  const { supabase, user, org, event } = await ownEvent(eventId);
  const { data: slots } = await supabase.from("slots").select("id,assignee_id,format_id,label,formats(name)").eq("event_id", event.id).eq("requested", true);
  // One notification per person, listing every format they were just given.
  const newlyAssigned = new Map<string, { formats: string[]; due: string | null }>();
  const writes: PromiseLike<unknown>[] = [];
  for (const s of slots ?? []) {
    const assignee = String(formData.get(`assignee_${s.id}`) ?? "") || null;
    const due = String(formData.get(`due_${s.id}`) ?? "") || null;
    writes.push(supabase.from("slots").update({ assignee_id: assignee, due_on: due, updated_at: new Date().toISOString() }).eq("id", s.id));
    const fmt = s.formats as unknown as { name: string } | null;
    if (assignee && assignee !== s.assignee_id) {
      const cur = newlyAssigned.get(assignee) ?? { formats: [], due: null };
      cur.formats.push(slotName(fmt?.name, s.label)); if (due && (!cur.due || due < cur.due)) cur.due = due;
      newlyAssigned.set(assignee, cur);
    }
  }
  await Promise.all(writes);
  if (event.status === "active") for (const [userId, a] of newlyAssigned) await notify(supabase, [userId], "slot.assigned", { eventId: event.id, title: event.title, format: a.formats.join(", "), assignee: userId, due: a.due, by: user.name ?? user.email }, user.id, { orgId: org.id });
  await supabase.from("events").update({ last_edited_at: new Date().toISOString() }).eq("id", event.id);
  revalidatePath(`/events/${event.id}`);
  goto(event.id, formData, "review");
}

/** Step 5. Draft → active. Enforces the event cap and horizon (PRD §8). */
export async function publishEvent(eventId: string) {
  const { supabase, user, org, event } = await ownEvent(eventId);
  if (event.status !== "draft") redirect(`/events/${event.id}`);
  const assets = isAssets(event);
  if (!event.event_date) throw new UserError(assets ? "Set the end date before publishing" : "Set the event date before publishing");
  if (assets && (event.event_date < todayIso() || event.event_date > assetEndMax())) throw new UserError(`Pick an end date within the next ${ASSET_MAX_DAYS} days`);
  if (!assets && !horizonOk(event.event_date)) throw new UserError(`Events can be at most ${MONTHS_AHEAD} months out`);
  const { data: brief } = await supabase.from("briefs").select("description").eq("event_id", event.id).maybeSingle();
  if (!brief?.description) throw new UserError(assets ? "Describe what you need before publishing" : "Add the brief before publishing");
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null);
  if ((count ?? 0) >= capFor(org)) {
    const { data: oldest } = await supabase.from("events").select("title,event_date").eq("org_id", org.id).eq("status", "active").is("deleted_at", null).order("event_date", { ascending: true }).limit(1).maybeSingle();
    throw new UserError(`All ${capFor(org)} project slots are in use. The oldest is "${oldest?.title}" (${oldest?.event_date}); an event frees its slot a week after its date, a request at its end date.`);
  }
  await supabase.from("events").update({ status: "active", published_at: new Date().toISOString() }).eq("id", event.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, actor_id: user.id, kind: "event.published", payload: { title: event.title } });
  // Designers hear about it in-app; the chat post lists who is on which format so the whole team sees the plan.
  const { data: slots } = await supabase.from("slots").select("assignee_id,due_on,label,formats(name,sort)").eq("event_id", event.id).eq("requested", true);
  const assignments = [...(slots ?? [])].sort((a, b) => ((a.formats as unknown as { sort: number })?.sort ?? 0) - ((b.formats as unknown as { sort: number })?.sort ?? 0))
    .map((s) => ({ format: slotName((s.formats as unknown as { name: string })?.name, s.label as string | null), userId: s.assignee_id as string | null, due: s.due_on as string | null }));
  await notify(supabase, assignments.map((a) => a.userId), "event.published", { eventId: event.id, kind: assets ? "assets" : "event", title: event.title, by: user.name ?? user.email, date: event.event_date, venue: event.venue, assignments }, user.id, { orgId: org.id });
  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

/** Creator may delete while nothing has been sent for review; Core Admins always (soft delete, PRD §8). */
/** Soft delete (PRD §8): Core Admins any event, everyone else only events they created. Restorable for 7 days from Archive. */
export async function deleteEvent(eventId: string) {
  const { supabase, user, event } = await ownEvent(eventId, { allowArchived: true });
  if (user.role !== "core_admin" && event.created_by !== user.id) throw new UserError("Only the person who created this event or a Core Admin can delete it");
  const { error } = await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", event.id);
  if (error) throw new UserError(error.message);
  await supabase.from("activity").insert({ org_id: event.org_id, event_id: event.id, actor_id: user.id, kind: "event.deleted", payload: { title: event.title } });
  revalidatePath("/events");
  redirect("/events");
}

/** Change who designs a format from the asset page. Core Admins, the event creator and approvers may. */
export async function assignSlot(slotId: string, userId: string | null) {
  const { supabase, user, org, isApprover } = await requireActiveUser();
  const { data: slot } = await supabase.from("slots").select("id,assignee_id,event_id,label,formats(name),events(id,org_id,title,status,created_by)").eq("id", slotId).maybeSingle();
  const event = slot?.events as unknown as { id: string; org_id: string; title: string; status: string; created_by: string } | null;
  if (!slot || !event || event.org_id !== org.id) throw new UserError("Format not found");
  if (event.status === "archived") throw new UserError("Archived events are read-only");
  if (user.role !== "core_admin" && !isApprover) throw new UserError("Only Core Admins and approvers can change who designs a format");
  if (userId) {
    const { data: member } = await supabase.from("users").select("id,org_memberships!inner(org_id)").eq("id", userId).eq("status", "active").eq("org_memberships.org_id", org.id).maybeSingle();
    // A guest on this project can be given its formats too (the project's People list, never anyone else's).
    const guest = !member && (await loadProjectPeople(supabase, event)).some((p) => p.guest && p.userId === userId) && !!(await supabase.from("users").select("id").eq("id", userId).eq("status", "active").maybeSingle()).data;
    if (!member && !guest) throw new UserError("That person is not in this organization or on this project");
  }
  if ((slot.assignee_id ?? null) === (userId ?? null)) return;
  const { error } = await supabase.from("slots").update({ assignee_id: userId, updated_at: new Date().toISOString() }).eq("id", slotId);
  if (error) throw new UserError(error.message);
  const formatName = slotName((slot.formats as unknown as { name: string } | null)?.name, slot.label as string | null);
  if (userId && event.status === "active") await notify(supabase, [userId], "slot.assigned", { eventId: event.id, slotId, title: event.title, format: formatName, assignee: userId, by: user.name ?? user.email }, user.id, { orgId: org.id });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slotId}`);
}
