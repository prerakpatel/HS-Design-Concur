"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { notify, eventParticipants } from "@/lib/notify";

async function loadVersion(versionId: string) {
  const ctx = await requireActiveUser();
  const { data: v } = await ctx.supabase.from("versions").select("*,slots(id,event_id,assignee_id,state,formats(name),events(id,org_id,title,status))").eq("id", versionId).maybeSingle();
  const slot = v?.slots as unknown as { id: string; event_id: string; assignee_id: string | null; state: string; formats: { name: string }; events: { id: string; org_id: string; title: string; status: string } } | null;
  if (!v || !slot || slot.events.org_id !== ctx.org.id) throw new Error("Version not found");
  if (slot.events.status === "archived") throw new Error("This event is archived and read-only");
  return { ...ctx, version: v, slot, event: slot.events, formatName: slot.formats?.name ?? "format" };
}

function canApprove(user: { is_approver: boolean; role: string }) { return user.is_approver || user.role === "core_admin"; }

/** Approve (PRD §6.2). `download` only changes what the client does afterwards. */
export async function approveVersion(versionId: string) {
  const { supabase, user, org, version, slot, event, formatName } = await loadVersion(versionId);
  if (!canApprove(user)) throw new Error("Only approvers can approve");
  if (version.uploaded_by === user.id) throw new Error("You cannot approve a version you uploaded");
  const now = new Date().toISOString();
  await supabase.from("versions").update({ decision: "superseded" }).eq("slot_id", slot.id).neq("id", versionId).eq("decision", "approved");
  await supabase.from("versions").update({ decision: "approved", decided_by: user.id, decided_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "approved", updated_at: now }).eq("id", slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.approved", payload: { format: formatName, number: version.number } });
  await notify(supabase, await eventParticipants(supabase, event.id), "version.approved", { eventId: event.id, slotId: slot.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

export async function requestChanges(versionId: string, body: string) {
  const { supabase, user, org, version, slot, event, formatName } = await loadVersion(versionId);
  if (!canApprove(user)) throw new Error("Only approvers can request changes");
  if (!body.trim()) throw new Error("Say what needs to change");
  const now = new Date().toISOString();
  await supabase.from("comments").insert({ version_id: versionId, author_id: user.id, body: body.trim() });
  await supabase.from("versions").update({ decision: "changes_requested", decided_by: user.id, decided_at: now }).eq("id", versionId);
  await supabase.from("slots").update({ state: "changes_requested", updated_at: now }).eq("id", slot.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slot.id, version_id: versionId, actor_id: user.id, kind: "version.changes_requested", payload: { format: formatName, number: version.number } });
  const { data: pubs } = await supabase.from("users").select("id,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id).contains("function_tags", ["publication"]);
  await notify(supabase, [slot.assignee_id ?? "", version.uploaded_by, ...(pubs ?? []).map((p) => p.id)], "version.changes_requested", { eventId: event.id, slotId: slot.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id });
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
  await notify(supabase, await eventParticipants(supabase, event.id), "version.reopened", { eventId: event.id, slotId: slot.id, title: event.title, format: formatName, number: version.number, by: user.name ?? user.email }, user.id, { orgId: org.id });
  revalidatePath(`/events/${event.id}`); revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

/** Comment with @mentions ("@Nikhil Joshi" or "@nikhil") and an optional pin. */
export async function addComment(versionId: string, body: string, pin?: { x: number; y: number } | null) {
  const { supabase, user, org, slot, event, formatName } = await loadVersion(versionId);
  const text = body.trim(); if (!text) throw new Error("Empty comment");
  const { data: members } = await supabase.from("users").select("id,name,email,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id);
  const mentions = new Set<string>();
  for (const m of members ?? []) {
    const name = (m.name ?? "").toLowerCase(); const first = name.split(" ")[0]; const handle = m.email.split("@")[0].toLowerCase();
    const lower = text.toLowerCase();
    if ((name && lower.includes("@" + name)) || (first && new RegExp(`@${first}(\\b|$)`).test(lower)) || lower.includes("@" + handle)) mentions.add(m.id);
  }
  const { error } = await supabase.from("comments").insert({ version_id: versionId, author_id: user.id, body: text, mentions: [...mentions], pin_x: pin?.x ?? null, pin_y: pin?.y ?? null });
  if (error) throw new Error(error.message);
  await notify(supabase, mentions, "comment.mention", { eventId: event.id, slotId: slot.id, title: event.title, format: formatName, by: user.name ?? user.email, excerpt: text.slice(0, 120) }, user.id);
  revalidatePath(`/events/${event.id}/slots/${slot.id}`);
  return { ok: true };
}

export async function setCommentFlag(commentId: string, flag: "addressed" | "confirmed" | "reopen") {
  const { supabase, user } = await requireActiveUser();
  const now = new Date().toISOString();
  const patch = flag === "addressed" ? { addressed_at: now, addressed_by: user.id }
    : flag === "confirmed" ? { confirmed_at: now, confirmed_by: user.id }
    : { addressed_at: null, addressed_by: null, confirmed_at: null, confirmed_by: null };
  if (flag !== "addressed" && !canApprove(user)) throw new Error("Only approvers can confirm or reopen a comment");
  const { data } = await supabase.from("comments").update(patch).eq("id", commentId).select("versions(slots(id,event_id))").single();
  const s = (data?.versions as unknown as { slots: { id: string; event_id: string } } | null)?.slots;
  if (s) revalidatePath(`/events/${s.event_id}/slots/${s.id}`);
}

/** Bulk approve (PRD §6.2): approves each version in turn; a failure on one does not stop the others. */
export async function approveMany(versionIds: string[]) {
  const failed: string[] = []; let approved = 0;
  for (const id of [...new Set(versionIds)]) {
    try { await approveVersion(id); approved++; } catch (e) { failed.push((e as Error).message); }
  }
  return { approved, failed };
}
