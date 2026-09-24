"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { notify, eventParticipants, taggedMemberIds } from "@/lib/notify";
import { signedUrl, BUCKET } from "@/lib/storage";
import { assetFilename } from "@/lib/labels";
import { recomputeSlotState } from "@/lib/slot-state";

async function loadVersion(versionId: string) {
  const ctx = await requireActiveUser();
  const { data: v } = await ctx.supabase.from("versions").select("*,slots(id,event_id,assignee_id,state,formats(name),events(id,org_id,title,status,created_by))").eq("id", versionId).maybeSingle();
  const slot = v?.slots as unknown as { id: string; event_id: string; assignee_id: string | null; state: string; formats: { name: string }; events: { id: string; org_id: string; title: string; status: string; created_by: string } } | null;
  if (!v || !slot || slot.events.org_id !== ctx.org.id) throw new Error("Version not found");
  if (slot.events.status === "archived") throw new Error("This event is archived and read-only");
  return { ...ctx, version: v, slot, event: slot.events, formatName: slot.formats?.name ?? "format" };
}

function canApprove(user: { is_approver: boolean; role: string }) { return user.is_approver || user.role === "core_admin"; }

type Loaded = Awaited<ReturnType<typeof loadVersion>>;

/**
 * Send an uploaded version to the approvers (PRD §6.2). Uploading is private so a designer can check the file,
 * replace it or add the back side first; this is the moment the slot moves to In review and people are told.
 */
export async function sendForReview(versionId: string) {
  const { supabase, user, org, version, slot, event, formatName } = await loadVersion(versionId);
  if (version.uploaded_by !== user.id && slot.assignee_id !== user.id && user.role !== "core_admin") throw new Error("Only the uploader, the assigned designer or a Core Admin can send this for review");
  if (version.sent_at) throw new Error("This version is already with the approvers");
  if (version.decision !== "pending") throw new Error("Only a pending version can be sent");
  const now = new Date().toISOString();
  await supabase.from("versions").update({ decision: "superseded" }).eq("slot_id", slot.id).neq("id", versionId).in("decision", ["pending", "changes_requested"]);
  await supabase.from("versions").update({ sent_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "in_review", updated_at: now }).eq("id", slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.sent", payload: { format: formatName, number: version.number } });
  const { data: approvers } = await supabase.from("users").select("id,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id).or("is_approver.eq.true,role.eq.core_admin");
  await notify(supabase, [...(approvers ?? []).map((a) => a.id), event.created_by], "version.uploaded", { eventId: event.id, slotId: slot.id, versionId, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** The database side of an approval; notifications are the caller's job so bulk approvals can post once. */
async function approveOne(versionId: string): Promise<Loaded> {
  const ctx = await loadVersion(versionId);
  const { supabase, user, org, version, slot, event, formatName } = ctx;
  if (!canApprove(user)) throw new Error("Only approvers can approve");
  if (version.uploaded_by === user.id) throw new Error("You cannot approve a version you uploaded");
  if (!version.sent_at) throw new Error("The designer has not sent this version for review yet");
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

/** Approve (PRD §6.2). `download` only changes what the client does afterwards. */
export async function approveVersion(versionId: string) {
  const ctx = await approveOne(versionId);
  const { supabase, user, org, version, slot, event, formatName } = ctx;
  await notify(supabase, await eventParticipants(supabase, event.id), "version.approved", { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id, mention: [version.uploaded_by, slot.assignee_id] });
  await announceIfAllApproved(ctx);
  return { ok: true };
}

export async function requestChanges(versionId: string, body: string) {
  const { supabase, user, org, version, slot, event, formatName } = await loadVersion(versionId);
  if (!canApprove(user)) throw new Error("Only approvers can request changes");
  if (!body.trim()) throw new Error("Say what needs to change");
  if (!version.sent_at) throw new Error("The designer has not sent this version for review yet");
  const now = new Date().toISOString();
  await supabase.from("comments").insert({ version_id: versionId, author_id: user.id, body: body.trim() });
  await supabase.from("versions").update({ decision: "changes_requested", decided_by: user.id, decided_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "changes_requested", updated_at: now }).eq("id", slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.changes_requested", payload: { format: formatName, number: version.number } });
  const pubs = await taggedMemberIds(supabase, org.id, "publication");
  await notify(supabase, [slot.assignee_id, version.uploaded_by, ...pubs], "version.changes_requested", { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email, excerpt: body.trim().slice(0, 200) }, user.id, { orgId: org.id, mention: [slot.assignee_id, version.uploaded_by] });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** Pull an approved asset back to work-in-progress (PRD §6.2 Reopen). */
export async function reopenVersion(versionId: string, reason: string) {
  const { supabase, user, org, version, slot, event, formatName } = await loadVersion(versionId);
  if (!canApprove(user)) throw new Error("Only approvers can reopen");
  if (version.decision !== "approved") throw new Error("Only an approved version can be reopened");
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
export async function addComment(versionId: string, body: string, pin?: { x: number; y: number; side?: "front" | "back" } | null) {
  const { supabase, user, org, version, slot, event, formatName } = await loadVersion(versionId);
  const text = body.trim(); if (!text) throw new Error("Empty comment");
  const { data: members } = await supabase.from("users").select("id,name,email,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id);
  const mentions = new Set<string>();
  for (const m of members ?? []) {
    const name = (m.name ?? "").toLowerCase(); const first = name.split(" ")[0]; const handle = m.email.split("@")[0].toLowerCase();
    const lower = text.toLowerCase();
    if ((name && lower.includes("@" + name)) || (first && new RegExp(`@${first}(\\b|$)`).test(lower)) || lower.includes("@" + handle)) mentions.add(m.id);
  }
  const { error } = await supabase.from("comments").insert({ version_id: versionId, author_id: user.id, body: text, mentions: [...mentions], pin_x: pin?.x ?? null, pin_y: pin?.y ?? null, pin_side: pin?.side ?? "front" });
  if (error) throw new Error(error.message);
  const payload = { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email, excerpt: text.slice(0, 200) };
  if (mentions.size) await notify(supabase, mentions, "comment.mention", payload, user.id, { orgId: org.id });
  else {
    // No @mention: it is for the designer, the uploader and whoever has already spoken on this version.
    const { data: prior } = await supabase.from("comments").select("author_id").eq("version_id", versionId);
    await notify(supabase, [slot.assignee_id, version.uploaded_by, ...(prior ?? []).map((c) => c.author_id as string)], "comment.posted", payload, user.id, { orgId: org.id });
  }
  revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** addressed ("done") and reopen: anyone on the event. confirmed: approvers. */
export async function setCommentFlag(commentId: string, flag: "addressed" | "unaddress" | "confirmed" | "reopen") {
  const { supabase, user } = await requireActiveUser();
  const now = new Date().toISOString();
  const patch = flag === "addressed" ? { addressed_at: now, addressed_by: user.id }
    : flag === "confirmed" ? { confirmed_at: now, confirmed_by: user.id }
    : { addressed_at: null, addressed_by: null, confirmed_at: null, confirmed_by: null };
  if (flag === "unaddress") {
    const { data: c } = await supabase.from("comments").select("confirmed_at").eq("id", commentId).maybeSingle();
    if (c?.confirmed_at && !canApprove(user)) throw new Error("This comment was confirmed by an approver; ask them to reopen it");
  } else if (flag === "confirmed" && !canApprove(user)) throw new Error("Only approvers can confirm a comment");
  const { data } = await supabase.from("comments").update(patch).eq("id", commentId).select("versions(slots(id,event_id))").single();
  const s = (data?.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}

/** Bulk approve (PRD §6.2): approves each version in turn and posts one summary; a failure on one does not stop the others. */
export async function approveMany(versionIds: string[]) {
  const failed: string[] = []; const done: Loaded[] = [];
  for (const id of [...new Set(versionIds)]) {
    try { done.push(await approveOne(id)); } catch (e) { failed.push((e as Error).message); }
  }
  if (done.length === 1) {
    const { supabase, user, org, version, slot, event, formatName } = done[0];
    await notify(supabase, await eventParticipants(supabase, event.id), "version.approved", { eventId: event.id, slotId: slot.id, versionId: version.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id, mention: [version.uploaded_by, slot.assignee_id] });
  } else if (done.length > 1) {
    // Usually one event; group anyway so a mixed selection still reads correctly.
    const byEvent = new Map<string, Loaded[]>();
    for (const d of done) byEvent.set(d.event.id, [...(byEvent.get(d.event.id) ?? []), d]);
    for (const group of byEvent.values()) {
      const { supabase, user, org, event } = group[0];
      const formats = group.map((g) => `${g.formatName} v${g.version.number}`).join(", ");
      await notify(supabase, await eventParticipants(supabase, event.id), "versions.approved", { eventId: event.id, title: event.title, count: group.length, formats, by: user.name ?? user.email }, user.id, { orgId: org.id, mention: group.flatMap((g) => [g.version.uploaded_by, g.slot.assignee_id]) });
    }
  }
  for (const first of new Map(done.map((d) => [d.event.id, d])).values()) await announceIfAllApproved(first);
  return { approved: done.length, failed };
}

/** Short-lived download link for an approved side, named year_event_format_vN. */
export async function downloadLink(versionId: string, side: "front" | "back" = "front") {
  const { supabase, version, event, formatName } = await loadVersion(versionId);
  if (version.decision !== "approved") throw new Error("Only approved versions can be downloaded");
  const { data: s } = await supabase.from("version_sides").select("optimised_path").eq("version_id", versionId).eq("side", side).maybeSingle();
  if (!s?.optimised_path) throw new Error("This file was removed after the event");
  const { data: ev } = await supabase.from("events").select("event_date").eq("id", event.id).single();
  const url = await signedUrl(supabase, s.optimised_path, 120, assetFilename({ eventDate: ev?.event_date ?? null, eventTitle: event.title, formatName, side, number: version.number, path: s.optimised_path }));
  if (!url) throw new Error("Could not create the download link");
  return url;
}

/** Remove a version and its files. Uploader or Core Admin. The slot's state follows whatever version remains. */
export async function deleteVersion(versionId: string) {
  const { supabase, user, version, slot, event, formatName, org } = await loadVersion(versionId);
  if (version.uploaded_by !== user.id && user.role !== "core_admin") throw new Error("Only the uploader or a Core Admin can delete a version");
  if (version.decision === "approved" && user.role !== "core_admin") throw new Error("An approved version can only be deleted by a Core Admin");
  const { data: sides } = await supabase.from("version_sides").select("optimised_path,preview_path,thumb_path,reference_path").eq("version_id", versionId);
  const paths = (sides ?? []).flatMap((s) => [s.optimised_path, s.preview_path, s.thumb_path, s.reference_path]).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("versions").delete().eq("id", versionId);
  if (error) throw new Error(error.message);
  await recomputeSlotState(supabase, slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, actor_id: user.id, kind: "version.deleted", payload: { format: formatName, number: version.number } });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

export async function editComment(commentId: string, body: string) {
  const { supabase, user } = await requireActiveUser();
  const text = body.trim(); if (!text) throw new Error("Empty comment");
  const { data: c } = await supabase.from("comments").select("author_id,versions(slots(id,event_id))").eq("id", commentId).maybeSingle();
  if (!c) throw new Error("Comment not found");
  if (c.author_id !== user.id && user.role !== "core_admin") throw new Error("You can only edit your own comments");
  const { error } = await supabase.from("comments").update({ body: text, edited_at: new Date().toISOString() }).eq("id", commentId);
  if (error) throw new Error(error.message);
  const s = (c.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}

export async function deleteComment(commentId: string) {
  const { supabase, user } = await requireActiveUser();
  const { data: c } = await supabase.from("comments").select("author_id,versions(slots(id,event_id))").eq("id", commentId).maybeSingle();
  if (!c) throw new Error("Comment not found");
  if (c.author_id !== user.id && user.role !== "core_admin") throw new Error("You can only delete your own comments");
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
  const s = (c.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}
