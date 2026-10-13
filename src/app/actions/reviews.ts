"use server";
import { MINUTE_MS } from "@/lib/time";
import { QUIET_RESEND_MINUTES } from "@/config/limits";
import { slotName } from "@/lib/project";
import { revalidatePath } from "next/cache";
import { requireViewer, projectContext } from "@/lib/auth";
import { serviceOr } from "@/lib/supabase/service";
import { loadProjectPeople } from "@/lib/project-people";
import { notify, eventParticipants, taggedMemberIds, approverIds } from "@/lib/notify";
import { signedUrl } from "@/lib/storage";
import { removeFiles } from "@/lib/files";
import { assetFilename } from "@/lib/labels";
import { recomputeSlotState } from "@/lib/slot-state";
import { sanitizeComment, plainText, mentionIds, groupMentionIds } from "@/lib/rich-text";
import { UserError } from "@/lib/user-error";

/** The version and its project, for a member of the project's organization or a guest on the project. */
async function loadVersion(versionId: string) {
  const viewer = await requireViewer();
  const { data: v } = await viewer.supabase.from("versions").select("*,slots(id,event_id,assignee_id,state,is_primary,label,formats(name),events(id,org_id,title,status,created_by))").eq("id", versionId).maybeSingle();
  const slot = v?.slots as unknown as { id: string; event_id: string; assignee_id: string | null; state: string; is_primary: boolean; label: string | null; formats: { name: string }; events: { id: string; org_id: string; title: string; status: string; created_by: string } } | null;
  const ctx = slot ? projectContext(viewer, slot.events.org_id) : null;
  if (!v || !slot || !ctx) throw new UserError("Version not found");
  if (slot.events.status === "archived") throw new UserError("This event is archived and read-only");
  return { ...ctx, version: v, slot, event: slot.events, formatName: slotName(slot.formats?.name, slot.label) };
}


type Loaded = Awaited<ReturnType<typeof loadVersion>>;

/** A decision applies to a version that is waiting for one and is the newest of its format, never to an older or already decided one. */
async function assertDecidable({ supabase, version, slot }: Loaded, verb: string, allowed: string[]) {
  if (!allowed.includes(version.decision)) throw new UserError(`This version is already ${version.decision === "approved" ? "approved" : "decided"}, so it can't be ${verb} again. Reload the page to see where it stands.`);
  const { data: newest } = await supabase.from("versions").select("number").eq("slot_id", slot.id).order("number", { ascending: false }).limit(1).maybeSingle();
  if (newest && newest.number !== version.number) throw new UserError(`A newer version (v${newest.number}) exists, so v${version.number} can't be ${verb}. Open the newest version.`);
}

/**
 * Send an uploaded version to the approvers (PRD §6.2). Uploading is private so a designer can check the file,
 * replace it or add the back side first; this is the moment the slot moves to In review and people are told.
 */
export async function sendForReview(versionId: string) {
  const { supabase, user, org, version, slot, event, formatName, guest } = await loadVersion(versionId);
  if (version.uploaded_by !== user.id && slot.assignee_id !== user.id && user.role !== "core_admin") throw new UserError("Only the uploader, the assigned designer or a Core Admin can send this for review");
  if (version.sent_at) throw new UserError("This version is already with the approvers");
  if (version.decision !== "pending") throw new UserError("Only a pending version can be sent");
  const now = new Date().toISOString();
  // Replacing a sent version's file makes it private again, so the designer sends it a second time. If the
  // approvers were told about this version in the last 10 minutes and have not acted since (no decision, no
  // comment), the resend is silent: the page already shows the newest file and nobody needs a second ping.
  const windowStart = new Date(Date.now() - QUIET_RESEND_MINUTES * MINUTE_MS).toISOString();
  const { data: prior } = await supabase.from("activity").select("created_at").eq("version_id", versionId).eq("kind", "version.sent").gte("created_at", windowStart).order("created_at", { ascending: false }).limit(1);
  let quietResend = false;
  if (prior?.length) {
    const since = prior[0].created_at as string;
    const [{ data: decided }, { data: talked }] = await Promise.all([
      supabase.from("activity").select("id").eq("version_id", versionId).in("kind", ["version.approved", "version.changes_requested"]).gt("created_at", since).limit(1),
      supabase.from("comments").select("id").eq("version_id", versionId).eq("is_draft", false).gt("created_at", since).limit(1),
    ]);
    quietResend = !decided?.length && !talked?.length;
  }
  // Older open versions step aside. A guest may not change other people's versions, so theirs runs with the service key.
  await (guest ? serviceOr(supabase) : supabase).from("versions").update({ decision: "superseded" }).eq("slot_id", slot.id).neq("id", versionId).in("decision", ["pending", "changes_requested"]);
  await supabase.from("versions").update({ sent_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "in_review", updated_at: now }).eq("id", slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.sent", payload: { format: formatName, number: version.number, ...(quietResend ? { resent: true } : {}) } });
  if (quietResend) { revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`); return { ok: true, quiet: true }; }
  // Read with the service key when a guest sends: they may not see the organization's approvers.
  const approvers = await approverIds(serviceOr(supabase), org.id);
  await notify(supabase, [...approvers, event.created_by], "version.uploaded", { eventId: event.id, slotId: slot.id, versionId, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** The database side of an approval; notifications are the caller's job so bulk approvals can post once. */
async function approveOne(versionId: string): Promise<Loaded> {
  const ctx = await loadVersion(versionId);
  const { supabase, user, org, version, slot, event, formatName, isApprover } = ctx;
  if (!isApprover) throw new UserError("Only approvers of this organization can approve");
  if (version.uploaded_by === user.id) throw new UserError("You cannot approve a version you uploaded");
  if (!version.sent_at) throw new UserError("The designer has not sent this version for review yet");
  // A version with changes requested can still be approved as it is (for example one reopened by accident).
  await assertDecidable(ctx, "approved", ["pending", "changes_requested"]);
  const now = new Date().toISOString();
  await supabase.from("versions").update({ decision: "superseded" }).eq("slot_id", slot.id).neq("id", versionId).eq("decision", "approved");
  await supabase.from("versions").update({ decision: "approved", decided_by: user.id, decided_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "approved", updated_at: now }).eq("id", slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.approved", payload: { format: formatName, number: version.number } });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return ctx;
}

/** When the last requested format is approved, tell the creator and Publication the event is ready to go out. */
async function announceIfAllApproved({ supabase, user, org, event }: Loaded) {
  const { data: slots } = await supabase.from("slots").select("state").eq("event_id", event.id).eq("requested", true);
  if (!slots?.length || slots.some((s) => s.state !== "approved")) return;
  const publication = await taggedMemberIds(supabase, org.id, "publication");
  await notify(supabase, [event.created_by, ...publication], "event.all_approved", { eventId: event.id, title: event.title, count: slots.length, by: user.name ?? user.email }, user.id, { orgId: org.id });
}

/**
 * The primary design unblocks every other format, so its approval gets its own message: a congratulations in
 * the org chat and a personal note to every designer on the event (the primary's own included), instead of the
 * usual "Approved" line.
 */
async function announceApproval(ctx: Loaded) {
  const { supabase, user, org, version, slot, event, formatName } = ctx;
  const payload = { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email };
  if (slot.is_primary) {
    const { data: slots } = await supabase.from("slots").select("assignee_id").eq("event_id", event.id).eq("requested", true);
    const designers = [...new Set([slot.assignee_id, version.uploaded_by, ...(slots ?? []).map((s) => s.assignee_id as string | null)])];
    await notify(supabase, designers, "primary.approved", { ...payload, slotId: undefined, href: `/events/${event.id}` }, user.id, { orgId: org.id });
    return;
  }
  await notify(supabase, await eventParticipants(supabase, event.id), "version.approved", payload, user.id, { orgId: org.id, mention: [version.uploaded_by, slot.assignee_id] });
}

/** Approve (PRD §6.2). `download` only changes what the client does afterwards. */
export async function approveVersion(versionId: string) {
  const ctx = await approveOne(versionId);
  await announceApproval(ctx);
  await announceIfAllApproved(ctx);
  return { ok: true };
}


/** Pull an approved asset back to work-in-progress (PRD §6.2 Reopen). */
export async function reopenVersion(versionId: string, reason: string) {
  const { supabase, user, org, version, slot, event, formatName, isApprover } = await loadVersion(versionId);
  if (!isApprover) throw new UserError("Only approvers of this organization can reopen");
  if (version.decision !== "approved") throw new UserError("Only an approved version can be reopened");
  const now = new Date().toISOString();
  await supabase.from("versions").update({ decision: "changes_requested", reopen_reason: reason.trim() || null, decided_by: user.id, decided_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "changes_requested", updated_at: now }).eq("id", slot.id);
  if (reason.trim()) await supabase.from("comments").insert({ version_id: versionId, author_id: user.id, body: `Reopened: ${reason.trim()}` });
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.reopened", payload: { format: formatName, number: version.number, reason } });
  await notify(supabase, await eventParticipants(supabase, event.id), "version.reopened", { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email, excerpt: reason.trim().slice(0, 200) }, user.id, { orgId: org.id, mention: [slot.assignee_id, version.uploaded_by] });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** Comment with @mentions ("@Nikhil Joshi" or "@nikhil") and an optional pin. */
export async function addComment(versionId: string, body: string, pin?: { x: number; y: number; side?: "front" | "back" } | null, opts?: { draft?: boolean; change?: boolean; reopen?: boolean }) {
  const ctx = await loadVersion(versionId);
  const { supabase, user, org, slot } = ctx;
  const html = sanitizeComment(body); const text = plainText(html); if (!text) throw new UserError("Empty comment");
  const [{ data: orgMembers }, people0] = await Promise.all([
    supabase.from("users").select("id,name,email,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id),
    loadProjectPeople(supabase, ctx.event),
  ]);
  // The project's guests can be @mentioned too; they are on its People list, not in the organization.
  const members = [...(orgMembers ?? []), ...people0.filter((p) => p.guest && p.userId).map((p) => ({ id: p.userId!, name: p.name, email: p.email }))];
  // Mentions come from the editor's @ chips; typed "@first" still counts for people who skip the popup.
  const people = mentionIds(html).filter((id) => (members ?? []).some((m) => m.id === id));
  const mentions = new Set<string>(people);
  // @Group: every member is told, and the comment lands in that group's chat whatever it normally hears about.
  const groupIds = groupMentionIds(html);
  if (groupIds.length) { const { data: gm } = await supabase.from("group_members").select("user_id,groups!inner(org_id)").in("group_id", groupIds).eq("groups.org_id", org.id); for (const row of gm ?? []) mentions.add(row.user_id as string); }
  for (const m of members ?? []) {
    const name = (m.name ?? "").toLowerCase(); const first = name.split(" ")[0]; const handle = m.email.split("@")[0].toLowerCase();
    const lower = text.toLowerCase();
    if ((name && lower.includes("@" + name)) || (first && new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`).test(lower)) || lower.includes("@" + handle)) mentions.add(m.id);
  }
  // A comment is conversation. Anyone can turn theirs into a change request: work for one person (whoever is @mentioned,
  // else whoever uploaded this version, else the format's designer) that sends the version back. On an approved version
  // that reopens it, which the person has to have confirmed.
  let assignee: string | null = null;
  if (opts?.change) {
    if (!ctx.version.sent_at) throw new UserError("The designer has not sent this version for review yet");
    if (ctx.version.decision === "approved" && !opts.reopen) throw new UserError("This version is approved. Asking for a change reopens it, so confirm that first.");
    const other = (id: string | null) => (id && id !== user.id ? id : null);
    assignee = people[0] ?? other(ctx.version.uploaded_by) ?? other(slot.assignee_id) ?? null;
    if (!opts.draft) await flipToChanges(ctx, !!opts.reopen);
  }
  // Review mode: the comment is saved but stays private to its author until the batch is sent.
  const { error } = await supabase.from("comments").insert({ version_id: versionId, author_id: user.id, body: html, mentions: [...mentions], pin_x: pin?.x ?? null, pin_y: pin?.y ?? null, pin_side: pin?.side ?? "front", is_draft: !!opts?.draft, needs_change: !!opts?.change, assignee_id: assignee });
  if (error) throw new UserError(error.message);
  if (!opts?.draft) {
    if (opts?.change) await announceChanges(ctx, [{ html, assignee }], ctx.version.decision === "approved");
    else await announceComments(ctx, [{ html, mentions: [...mentions] }]);
  }
  revalidatePath(`/events/${ctx.event.id}/slots/${slot.id}`);
  return { ok: true };
}

/**
 * One chat post and one notification for a batch of comments. A single comment keeps the classic wording; several
 * read as "N comments" with each one listed. People @mentioned in any comment are told; if a comment mentions no
 * one it is also for the designer, the uploader and whoever has already spoken on this version.
 */
async function announceComments({ supabase, user, org, version, slot, event, formatName }: Loaded, rows: { html: string; mentions: string[] }[]) {
  const mentioned = new Set(rows.flatMap((r) => r.mentions));
  const groupIds = [...new Set(rows.flatMap((r) => groupMentionIds(r.html)))];
  const texts = rows.map((r) => plainText(r.html));
  const by = user.name ?? user.email;
  const base = { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by, groups: groupIds };
  const needsDefault = rows.some((r) => r.mentions.length === 0);
  let defaults: (string | null)[] = [];
  if (needsDefault) {
    const { data: prior } = await supabase.from("comments").select("author_id").eq("version_id", version.id);
    defaults = [slot.assignee_id, version.uploaded_by, ...(prior ?? []).map((c) => c.author_id as string)];
  }
  if (rows.length === 1) {
    const payload = { ...base, excerpt: texts[0].slice(0, 200), excerptHtml: rows[0].html };
    if (mentioned.size) await notify(supabase, mentioned, "comment.mention", payload, user.id, { orgId: org.id });
    else await notify(supabase, defaults, "comment.posted", payload, user.id, { orgId: org.id, mention: [] });
    return;
  }
  const payload = { ...base, count: rows.length, items: rows.map((r) => r.html), excerpt: texts.map((t) => `• ${t}`).join("\n").slice(0, 300) };
  await notify(supabase, [...mentioned, ...defaults], "comments.posted", payload, user.id, { orgId: org.id, mention: [...mentioned] });
}

/**
 * Send the version back for changes (once): from in review, or from approved when the person confirmed the reopen. The
 * database function checks they belong to the organisation and that this is the newest sent version.
 */
async function flipToChanges({ supabase, user, org, version, slot, event, formatName }: Loaded, reopen: boolean) {
  if (version.decision === "changes_requested") return;
  const { error } = await supabase.rpc("flip_to_changes", { p_version: version.id, p_reopen: reopen });
  if (error) throw new UserError(error.message);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: version.id, actor_id: user.id, kind: version.decision === "approved" ? "version.reopened" : "version.changes_requested", payload: { format: formatName, number: version.number } });
  revalidatePath(`/events/${event.id}`);
}

/** Tell the people the changes are for, in one message, in chat as well as in-app. A change request is what the designer works from. */
async function announceChanges(ctx: Loaded, rows: { html: string; assignee: string | null }[], reopened = false) {
  const { supabase, user, org, version, slot, event, formatName } = ctx;
  const assignees = [...new Set(rows.map((r) => r.assignee).filter((a): a is string => !!a))];
  const texts = rows.map((r) => plainText(r.html));
  const base = { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email, assignees, reopened };
  const payload = rows.length === 1 ? { ...base, count: 1, excerpt: texts[0].slice(0, 200), excerptHtml: rows[0].html } : { ...base, count: rows.length, items: rows.map((r) => r.html), excerpt: texts.map((t) => `• ${t}`).join("\n").slice(0, 300) };
  await notify(supabase, [...assignees, slot.assignee_id], "changes.requested", payload, user.id, { orgId: org.id, mention: assignees });
  revalidatePath(`/events/${event.id}`);
}

/** Send everything the caller has queued on this version as one notification. Returns how many went out. */
export async function sendCommentBatch(versionId: string) {
  const ctx = await loadVersion(versionId);
  const { supabase, user, slot, event } = ctx;
  const { data: drafts } = await supabase.from("comments").select("id,body,mentions,needs_change,assignee_id").eq("version_id", versionId).eq("author_id", user.id).eq("is_draft", true).order("created_at");
  if (!drafts?.length) throw new UserError("There are no unsent comments");
  // Sending change requests sends the version back first; if that is no longer possible nothing is sent.
  if (drafts.some((d) => d.needs_change)) await flipToChanges(ctx, false);
  const { error } = await supabase.from("comments").update({ is_draft: false }).in("id", drafts.map((d) => d.id));
  if (error) throw new UserError(error.message);
  const changes = drafts.filter((d) => d.needs_change);
  const plain = drafts.filter((d) => !d.needs_change);
  if (changes.length) await announceChanges(ctx, changes.map((d) => ({ html: d.body as string, assignee: (d.assignee_id as string | null) ?? null })));
  if (plain.length) await announceComments(ctx, plain.map((d) => ({ html: d.body as string, mentions: [...new Set([...((d.mentions as string[]) ?? []), ...mentionIds(d.body as string)])] })));
  revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true, count: drafts.length };
}

/** Throw away the caller's unsent comments on this version. */
export async function discardCommentBatch(versionId: string) {
  const { supabase, user, slot, event } = await loadVersion(versionId);
  await supabase.from("comments").delete().eq("version_id", versionId).eq("author_id", user.id).eq("is_draft", true);
  revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** addressed ("done") and reopen: anyone on the event. confirmed: approvers. */
export async function setCommentFlag(commentId: string, flag: "addressed" | "unaddress" | "confirmed" | "reopen") {
  if (!["addressed", "unaddress", "confirmed", "reopen"].includes(flag)) throw new UserError("Unknown action");
  const viewer = await requireViewer();
  const { data: c } = await viewer.supabase.from("comments").select("confirmed_at,versions(slots(events(org_id)))").eq("id", commentId).maybeSingle();
  if (!c) throw new UserError("Comment not found");
  // Being an approver is per organisation: judge it against the organisation this comment belongs to.
  const commentOrg = (c.versions as unknown as { slots: { events: { org_id: string } } } | null)?.slots?.events?.org_id;
  const ctx = commentOrg ? projectContext(viewer, commentOrg) : null;
  if (!ctx) throw new UserError("Comment not found");
  const { supabase, user, isApprover } = ctx;
  const now = new Date().toISOString();
  const patch = flag === "addressed" ? { addressed_at: now, addressed_by: user.id }
    : flag === "confirmed" ? { confirmed_at: now, confirmed_by: user.id }
    : { addressed_at: null, addressed_by: null, confirmed_at: null, confirmed_by: null };
  if (flag === "confirmed" && !isApprover) throw new UserError("Only approvers can confirm a comment");
  // An approver's confirmation stays unless an approver undoes it.
  if ((flag === "unaddress" || flag === "reopen") && c.confirmed_at && !isApprover) throw new UserError("This comment was confirmed by an approver; ask them to reopen it");
  const { data } = await supabase.from("comments").update(patch).eq("id", commentId).select("versions(slots(id,event_id))").single();
  const s = (data?.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}

/** Bulk approve (PRD §6.2): approves each version in turn and posts one summary; a failure on one does not stop the others. */
export async function approveMany(versionIds: string[]) {
  const failed: string[] = []; const done: Loaded[] = [];
  // Each format is its own slot, so they approve side by side; one failing does not stop the others.
  for (const r of await Promise.allSettled([...new Set(versionIds)].map((id) => approveOne(id)))) {
    if (r.status === "fulfilled") done.push(r.value); else failed.push((r.reason as Error).message);
  }
  if (done.length === 1) {
    await announceApproval(done[0]);
  } else if (done.length > 1) {
    // Usually one event; group anyway so a mixed selection still reads correctly.
    const byEvent = new Map<string, Loaded[]>();
    for (const d of done) byEvent.set(d.event.id, [...(byEvent.get(d.event.id) ?? []), d]);
    for (const group of byEvent.values()) {
      const { supabase, user, org, event } = group[0];
      const formats = group.map((g) => `${g.formatName} v${g.version.number}`).join(", ");
      for (const g of group) if (g.slot.is_primary) await announceApproval(g);
      await notify(supabase, await eventParticipants(supabase, event.id), "versions.approved", { eventId: event.id, title: event.title, count: group.length, formats, by: user.name ?? user.email }, user.id, { orgId: org.id, mention: group.flatMap((g) => [g.version.uploaded_by, g.slot.assignee_id]) });
    }
  }
  for (const first of new Map(done.map((d) => [d.event.id, d])).values()) await announceIfAllApproved(first);
  return { approved: done.length, failed };
}

/** Short-lived download link for an approved side, named year_event_format_vN. */
export async function downloadLink(versionId: string, side: "front" | "back" = "front") {
  const { supabase, version, event, formatName } = await loadVersion(versionId);
  if (version.decision !== "approved") throw new UserError("Only approved versions can be downloaded");
  const { data: s } = await supabase.from("version_sides").select("optimised_path").eq("version_id", versionId).eq("side", side).maybeSingle();
  if (!s?.optimised_path) throw new UserError("This file was removed after the event");
  const { data: ev } = await supabase.from("events").select("event_date").eq("id", event.id).single();
  const url = await signedUrl(supabase, s.optimised_path, 120, assetFilename({ eventDate: ev?.event_date ?? null, eventTitle: event.title, formatName, side, number: version.number, path: s.optimised_path }));
  if (!url) throw new UserError("Could not create the download link");
  return url;
}

/** Remove a version and its files. Uploader or Core Admin. The slot's state follows whatever version remains. */
export async function deleteVersion(versionId: string) {
  const { supabase, user, version, slot, event, formatName, org } = await loadVersion(versionId);
  if (version.uploaded_by !== user.id && user.role !== "core_admin") throw new UserError("Only the uploader or a Core Admin can delete a version");
  if (version.decision === "approved" && user.role !== "core_admin") throw new UserError("An approved version can only be deleted by a Core Admin");
  const { data: sides } = await supabase.from("version_sides").select("optimised_path,preview_path,thumb_path,reference_path").eq("version_id", versionId);
  const paths = (sides ?? []).flatMap((s) => [s.optimised_path, s.preview_path, s.thumb_path, s.reference_path]).filter((p): p is string => !!p);
  if (paths.length) await removeFiles(supabase, paths);
  const { error } = await supabase.from("versions").delete().eq("id", versionId);
  if (error) throw new UserError(error.message);
  await recomputeSlotState(supabase, slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, actor_id: user.id, kind: "version.deleted", payload: { format: formatName, number: version.number } });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/**
 * Delete one side of a version (the front or the back); the other side stays. When it is the version's only
 * file, the whole version goes, as deleteVersion does. Same permissions as deleting a version.
 */
export async function deleteVersionSide(versionId: string, side: "front" | "back") {
  const { supabase, user, version, slot, event, formatName, org } = await loadVersion(versionId);
  if (version.uploaded_by !== user.id && user.role !== "core_admin") throw new UserError("Only the uploader or a Core Admin can delete a file");
  if (version.decision === "approved" && user.role !== "core_admin") throw new UserError("An approved version can only be changed by a Core Admin");
  const { data: sides } = await supabase.from("version_sides").select("id,side,optimised_path,preview_path,thumb_path,reference_path").eq("version_id", versionId);
  const target = (sides ?? []).find((x) => x.side === side);
  if (!target) throw new UserError(`This version has no ${side} to delete`);
  if ((sides ?? []).length <= 1) { await deleteVersion(versionId); return { ok: true, versionRemoved: true }; }
  const paths = [target.optimised_path, target.preview_path, target.thumb_path, target.reference_path].filter((p): p is string => !!p);
  if (paths.length) await removeFiles(supabase, paths);
  const { error } = await supabase.from("version_sides").delete().eq("id", target.id);
  if (error) throw new UserError(error.message);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.updated", payload: { format: formatName, number: version.number } });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true, versionRemoved: false };
}

export async function editComment(commentId: string, body: string) {
  const { supabase, user } = await requireViewer();
  const html = sanitizeComment(body); if (!plainText(html)) throw new UserError("Empty comment");
  const { data: c } = await supabase.from("comments").select("author_id,is_draft,versions(slots(id,event_id))").eq("id", commentId).maybeSingle();
  if (!c) throw new UserError("Comment not found");
  if (c.author_id !== user.id) throw new UserError("You can only edit your own comments");
  const { error } = await supabase.from("comments").update(c.is_draft ? { body: html } : { body: html, edited_at: new Date().toISOString() }).eq("id", commentId);
  if (error) throw new UserError(error.message);
  const s = (c.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}

export async function deleteComment(commentId: string) {
  const { supabase, user } = await requireViewer();
  const { data: c } = await supabase.from("comments").select("author_id,versions(slots(id,event_id))").eq("id", commentId).maybeSingle();
  if (!c) throw new UserError("Comment not found");
  if (c.author_id !== user.id && user.role !== "core_admin") throw new UserError("You can only delete your own comments");
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new UserError(error.message);
  const s = (c.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}
