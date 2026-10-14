"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { UserError } from "@/lib/user-error";
import { assistantAllowed } from "@/lib/assistant/access";
import { loadAssistantContext, resolveId } from "@/lib/assistant/context";
import { think, unclear } from "@/lib/assistant/brain";
import { insertDraftProject, requestFormats } from "@/lib/create-project";
import { addComment } from "@/app/actions/reviews";
import { DEFAULT_VENUE } from "@/config/orgs";
import type { CommentDraft, Outcome, Person, ProjectDraft, Turn, Where, FormatPick } from "@/lib/assistant/schema";

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
  try { result = await think(context.text, recent, where); }
  catch (e) { if (e instanceof UserError) throw e; console.error("assistant", e); return { outcome: unclear("Something went wrong on my side. Try again?"), raw: "", people: context.people }; }
  const o = result.outcome;
  // Short ids → real ids. Anything made up is dropped so nothing can be created against it.
  const projects = o.projects.map((p) => ({ ...p, formats: p.formats.filter((f) => context.formatKeys.has(f.formatKey)), gaps: [...p.gaps, ...p.formats.filter((f) => !context.formatKeys.has(f.formatKey)).map((f) => `No format called “${f.formatKey}” in the catalogue`)] }));
  const addFormats = o.addFormats && resolveId(context, o.addFormats.eventId) ? { ...o.addFormats, eventId: resolveId(context, o.addFormats.eventId)!, formats: o.addFormats.formats.filter((f) => context.formatKeys.has(f.formatKey)) } : null;
  const comments = o.comments.map((c) => ({ ...c, eventId: resolveId(context, c.eventId) ?? "", slotId: resolveId(context, c.slotId) ?? "", mentionUserIds: c.mentionUserIds.map((id) => resolveId(context, id)).filter((id): id is string => !!id) })).filter((c) => c.eventId && c.slotId);
  const outcome: Outcome = { ...o, projects, addFormats, comments };
  if (o.kind === "draft" && !projects.length && !addFormats && !comments.length) return { outcome: unclear("I couldn't pin that to a project or design. Which one is it?"), raw: result.raw, people: context.people };
  return { outcome, raw: result.raw, people: context.people };
}

/** Create the drafted projects. Each is a draft, exactly as the wizard makes them; the person finishes it on the review step. */
export async function assistantCreateProjects(drafts: ProjectDraft[]): Promise<{ ids: string[]; notes: string[] }> {
  const ctx = await requireAssistant();
  if (!drafts.length) throw new UserError("Nothing to create");
  const ids: string[] = []; const notes: string[] = [];
  for (const d of drafts) {
    const title = d.title.trim(); if (!title) throw new UserError("A project needs a title");
    const id = await insertDraftProject(ctx, { title, eventDate: d.eventDate, venue_name: d.venueName ?? DEFAULT_VENUE.name, venue_address: d.venueName ? null : DEFAULT_VENUE.address, description: d.description, notes: d.notes });
    const r = await requestFormats(ctx, id, d.formats, d.primaryFormatKey);
    if (r.skipped.length) notes.push(`${title}: skipped ${r.skipped.join(", ")}`);
    ids.push(id);
  }
  revalidatePath("/events");
  return { ids, notes };
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
