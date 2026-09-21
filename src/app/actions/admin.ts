"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import type { FunctionTag } from "@/lib/types";

async function requireCoreAdmin() {
  const ctx = await requireActiveUser();
  if (ctx.user.role !== "core_admin") throw new Error("Core Admins only");
  return ctx;
}

async function setMemberships(supabase: Awaited<ReturnType<typeof requireCoreAdmin>>["supabase"], userId: string, orgIds: string[]) {
  await supabase.from("org_memberships").delete().eq("user_id", userId);
  if (orgIds.length) await supabase.from("org_memberships").insert(orgIds.map((org_id) => ({ user_id: userId, org_id })));
}

export async function decideAccess(userId: string, formData: FormData) {
  const { supabase, user } = await requireCoreAdmin();
  const approve = formData.get("decision") === "approve";
  const orgIds = formData.getAll("org").map(String);
  if (approve && orgIds.length === 0) throw new Error("Pick at least one organisation");
  await supabase.from("users").update({ status: approve ? "active" : "removed" }).eq("id", userId);
  await supabase.from("access_requests").update({ decided_by: user.id, decided_at: new Date().toISOString(), decision: approve ? "approved" : "denied" }).eq("user_id", userId).is("decided_at", null);
  if (approve) { await setMemberships(supabase, userId, orgIds); await notify(supabase, [userId], "access.approved", { by: user.name ?? user.email }); }
  revalidatePath("/settings");
}

export async function updateUser(userId: string, formData: FormData) {
  const { supabase, user } = await requireCoreAdmin();
  const role = formData.get("role") === "core_admin" ? "core_admin" : "member";
  const is_approver = formData.get("is_approver") === "on";
  const function_tags = formData.getAll("tag").map(String).filter((t): t is FunctionTag => ["central", "publication", "designer"].includes(t));
  const orgIds = formData.getAll("org").map(String);
  if (userId === user.id && role !== "core_admin") throw new Error("You cannot demote yourself");
  if (role !== "core_admin") {
    const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "core_admin").eq("status", "active").neq("id", userId);
    if ((count ?? 0) === 0) throw new Error("There must be at least one Core Admin");
  }
  await supabase.from("users").update({ role, is_approver, function_tags }).eq("id", userId);
  await setMemberships(supabase, userId, orgIds);
  revalidatePath("/settings");
}

export async function removeUser(userId: string) {
  const { supabase, user } = await requireCoreAdmin();
  if (userId === user.id) throw new Error("You cannot remove yourself");
  const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "core_admin").eq("status", "active").neq("id", userId);
  if ((count ?? 0) === 0) throw new Error("There must be at least one Core Admin");
  await supabase.from("users").update({ status: "removed" }).eq("id", userId);
  await supabase.from("org_memberships").delete().eq("user_id", userId);
  revalidatePath("/settings");
}

export async function updateOrgSettings(orgId: string, formData: FormData) {
  const { supabase } = await requireCoreAdmin();
  await supabase.from("organisations").update({
    accepting_signups: formData.get("accepting_signups") === "on",
    email_enabled: formData.get("email_enabled") === "on",
    chat_enabled: formData.get("chat_enabled") === "on",
    chat_webhook_url: String(formData.get("chat_webhook_url") ?? "").trim() || null,
  }).eq("id", orgId);
  revalidatePath("/settings");
}
