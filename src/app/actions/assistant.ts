"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { UserError } from "@/lib/user-error";
import { assistantAllowed } from "@/lib/assistant/access";
import { loadAssistantContext, resolveId } from "@/lib/assistant/context";
import { unclear } from "@/lib/assistant/outcome";
import { insertDraftProject, requestFormats } from "@/lib/create-project";
import { assignSlot, publishDraft } from "@/app/actions/events";
import { wizardStatus } from "@/lib/wizard-status";
import { addComment } from "@/app/actions/reviews";
import { DEFAULT_VENUE } from "@/config/orgs";
import type { CommentDraft, Outcome, Person, ProjectDraft, ProjectUpdate, Turn, Where, FormatPick } from "@/lib/assistant/schema";

async function requireAssistant() {
  const ctx = await requireActiveUser();
  if (!assistantAllowed(ctx.user)) throw new UserError("The assistant is not switched on for you");
  return ctx;
}

/**
 * One turn of the thread: what the person said (typed or transcribed) plus the thread so far → one card. The reply
 * comes back with real ids, checked against what the person may see; the people list feeds the card's pickers.
 */
export async function assistantTurn(thread: Turn[], where: Where): Promise<{ outcome: Outcome; raw: string; people: Person[] }> {
  const ctx = await requireAssistant();
  const context = await loadAssistantContext(ctx, where);
  let result: { outcome: Outcome; raw: string };
  // The last few turns are enough history; it must start with the person's words.
  const recent = thread.slice(-12); while (recent.length && recent[0].role !== "user") recent.shift();
  // The model's library is loaded on first use, not with every page.
  const { think } = await import("@/lib/assistant/brain");
  try { result = await think(context.text, recent, where); }
  catch (e) { if (e instanceof UserError) throw e; console.error("assistant", e); return { outcome: unclear("Something went wrong on my side. Try again?"), raw: "", people: context.people }; }
  const o = result.outcome;
  // Short ids → real ids. Anything made up is dropped so nothing can be created against it.
  const projects = o.projects.map((p) => ({ ...p, formats: p.formats.filter((f) => context.formatKeys.has(f.formatKey)), gaps: [...p.gaps, ...p.formats.filter((f) => !context.formatKeys.has(f.formatKey)).map((f) => `No format called “${f.formatKey}” in the catalogue`)] }));
  const addFormats = o.addFormats && resolveId(context, o.addFormats.eventId) ? { ...o.addFormats, eventId: resolveId(context, o.addFormats.eventId)!, formats: o.addFormats.formats.filter((f) => context.formatKeys.has(f.formatKey)) } : null;
  const comments = o.comments.map((c) => ({ ...c, eventId: resolveId(context, c.eventId) ?? "", slotId: resolveId(context, c.slotId) ?? "", mentionUserIds: c.mentionUserIds.map((id) => resolveId(context, id)).filter((id): id is string => !!id) })).filter((c) => c.eventId && c.slotId);
  const updateProject = o.updateProject && resolveId(context, o.updateProject.eventId) ? { ...o.updateProject, eventId: resolveId(context, o.updateProject.eventId)!, assignments: o.updateProject.assignments.map((a) => ({ ...a, slotId: resolveId(context, a.slotId) ?? "", userId: resolveId(context, a.userId) ?? "" })).filter((a) => a.slotId && a.userId) } : null;
  const outcome: Outcome = { ...o, projects, addFormats, updateProject, comments };
  if (o.kind === "draft" && !projects.length && !addFormats && !updateProject && !comments.length) return { outcome: unclear("I couldn't pin that to a project or design. Which one is it?"), raw: result.raw, people: context.people };
  return { outcome, raw: result.raw, people: context.people };
}

/** Create the drafted projects. Each is a draft, exactly as the wizard makes them; the person finishes it on the review step. */
export async function assistantCreateProjects(drafts: ProjectDraft[]): Promise<{ ids: string[]; notes: string[]; needs: string[][] }> {
  const ctx = await requireAssistant();
  if (!drafts.length) throw new UserError("Nothing to create");
  const ids: string[] = []; const notes: string[] = []; const needs: string[][] = [];
  for (const d of drafts) {
    const title = d.title.trim(); if (!title) throw new UserError("A project needs a title");
    const id = await insertDraftProject(ctx, { title, eventDate: d.eventDate, venue_name: d.venueName ?? DEFAULT_VENUE.name, venue_address: d.venueName ? null : DEFAULT_VENUE.address, description: d.description, notes: d.notes });
    const r = await requestFormats(ctx, id, d.formats, d.primaryFormatKey);
    if (r.skipped.length) notes.push(`${title}: skipped ${r.skipped.join(", ")}`);
    ids.push(id); needs.push(await stillNeeds(ctx, id));
  }
  revalidatePath("/events");
  return { ids, notes, needs };
}

/** What stands between a draft and publishing, in the wizard's own words (blocking first). Empty once it can be published. */
async function stillNeeds(ctx: Awaited<ReturnType<typeof requireAssistant>>, eventId: string): Promise<string[]> {
  const [{ data: event }, { data: brief }, { data: slots }] = await Promise.all([
    ctx.supabase.from("events").select("title,event_date,kind,status").eq("id", eventId).maybeSingle(),
    ctx.supabase.from("briefs").select("description,time_text,venue_name").eq("event_id", eventId).maybeSingle(),
    ctx.supabase.from("slots").select("assignee_id,is_primary").eq("event_id", eventId).eq("requested", true),
  ]);
  if (!event || event.status !== "draft") return [];
  const { issues } = wizardStatus({ title: event.title as string, eventDate: event.event_date as string | null, brief: brief as { description: string | null; time_text: string | null; venue_name: string | null } | null, requestedSlots: (slots ?? []) as { assignee_id: string | null; is_primary?: boolean }[], assets: event.kind === "assets" });
  return [...issues.filter((i) => i.blocking), ...issues.filter((i) => !i.blocking)].map((i) => (i.blocking ? i.text : `${i.text} (not blocking)`));
}

/**
 * Fill in a project's details, give formats to people, and publish when asked: the Event, Designers and Review steps
 * of the wizard, by voice. Only the fields given change. Assigning follows the same rule as the wizard (Core Admins
 * and approvers); publishing the same checks.
 */
export async function assistantUpdateProject(u: ProjectUpdate): Promise<{ changed: string[]; published: boolean; needs: string[] }> {
  const ctx = await requireAssistant();
  const { supabase } = ctx;
  const { data: event } = await supabase.from("events").select("id,org_id,status,title,event_date,venue,brief_locked_at").eq("id", u.eventId).is("deleted_at", null).maybeSingle();
  if (!event || event.org_id !== ctx.org.id) throw new UserError("Project not found in this organization");
  if (event.status === "archived") throw new UserError("Archived projects are read-only");
  const changed: string[] = [];
  const patch: Record<string, unknown> = {};
  if (u.title?.trim() && u.title.trim() !== event.title) { patch.title = u.title.trim(); changed.push("title"); }
  if (u.eventDate && u.eventDate !== event.event_date) { patch.event_date = u.eventDate; changed.push("date"); }
  if (u.venueName?.trim()) { patch.venue = u.venueName.trim(); changed.push("venue"); }
  if (Object.keys(patch).length) { const { error } = await supabase.from("events").update({ ...patch, last_edited_at: new Date().toISOString() }).eq("id", event.id); if (error) throw new UserError(error.message); }
  // The brief locks once the first design is uploaded (only the venue name may change then), as in the wizard.
  const locked = !!event.brief_locked_at;
  const brief: Record<string, string> = {};
  if (u.venueName?.trim()) brief.venue_name = u.venueName.trim();
  if (!locked) {
    if (u.venueAddress?.trim()) brief.venue_address = u.venueAddress.trim();
    if (u.timeText?.trim()) { brief.time_text = u.timeText.trim(); changed.push("timings"); }
    if (u.description?.trim()) { brief.description = u.description.trim(); changed.push("invite text"); }
    if (u.notes?.trim()) { brief.notes = u.notes.trim(); changed.push("notes"); }
  } else if (u.timeText || u.description || u.notes) throw new UserError("A design was already uploaded, so the brief is locked; only the venue name can change now");
  if (Object.keys(brief).length) { const { error } = await supabase.from("briefs").upsert({ event_id: event.id, ...brief }); if (error) throw new UserError(error.message); }
  for (const a of u.assignments) { await assignSlot(a.slotId, a.userId); changed.push(`${a.slotName} → ${a.userName}`); }
  let published = false;
  if (u.publish) { await publishDraft(event.id); published = true; }
  revalidatePath(`/events/${event.id}`);
  return { changed, published, needs: published ? [] : await stillNeeds(ctx, event.id) };
}

export async function assistantAddFormats(eventId: string, formats: FormatPick[]): Promise<{ added: string[]; skipped: string[] }> {
  const ctx = await requireAssistant();
  const { data: event } = await ctx.supabase.from("events").select("id,org_id,status").eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (!event || event.org_id !== ctx.org.id) throw new UserError("Project not found in this organization");
  if (event.status === "archived") throw new UserError("Archived projects are read-only");
  const r = await requestFormats(ctx, eventId, formats, null);
  revalidatePath(`/events/${eventId}`);
  return r;
}

/**
 * Post the drafted comments on the newest design of the format. Change requests need a design that was sent for
 * review; when there is none yet they are posted as plain comments and the person is told.
 */
export async function assistantComment(draft: CommentDraft): Promise<{ posted: number; note: string | null; versionId: string }> {
  const ctx = await requireAssistant();
  const { data: version } = await ctx.supabase.from("versions").select("id,sent_at,decision").eq("slot_id", draft.slotId).order("number", { ascending: false }).limit(1).maybeSingle();
  if (!version) throw new UserError("Nothing has been uploaded for that format yet, so there is nothing to comment on");
  const { data: people } = draft.mentionUserIds.length ? await ctx.supabase.from("users").select("id,name,email").in("id", draft.mentionUserIds) : { data: [] };
  const chips = (people ?? []).map((p) => `<span data-type="mention" data-id="${p.id}" data-label="${esc(p.name ?? p.email)}" class="mention">@${esc(p.name ?? p.email)}</span>`).join(" ");
  const change = draft.change && !!version.sent_at;
  let posted = 0;
  for (const item of draft.items.map((t) => t.trim()).filter(Boolean)) {
    await addComment(version.id, `<p>${chips ? chips + " " : ""}${esc(item)}</p>`, null, { change, reopen: change && version.decision === "approved" });
    posted++;
  }
  if (!posted) throw new UserError("Nothing to post");
  return { posted, note: draft.change && !change ? "That design hasn't been sent for review yet, so these went in as comments rather than change requests." : null, versionId: version.id };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
