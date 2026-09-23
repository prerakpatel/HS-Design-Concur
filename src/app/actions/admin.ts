"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import type { FunctionTag } from "@/lib/types";
import { EVENT_CAP, DELETE_RESTORE_DAYS } from "@/config/limits";

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

const LOGO_EXT: Record<string, string> = { "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp", "image/jpeg": "jpg" };

export async function updateOrgSettings(orgId: string, formData: FormData) {
  const { supabase } = await requireCoreAdmin();
  const patch: Record<string, unknown> = {
    accepting_signups: formData.get("accepting_signups") === "on",
    ...(formData.has("email_enabled") || process.env.RESEND_API_KEY ? { email_enabled: formData.get("email_enabled") === "on" } : {}),
    chat_enabled: formData.get("chat_enabled") === "on",
    chat_webhook_url: String(formData.get("chat_webhook_url") ?? "").trim() || null,
    slack_enabled: formData.get("slack_enabled") === "on",
    slack_webhook_url: String(formData.get("slack_webhook_url") ?? "").trim() || null,
  };
  const { data: cur } = await supabase.from("organisations").select("slug,logo_path").eq("id", orgId).single();
  const logo = formData.get("logo");
  if (formData.get("remove_logo") === "on") {
    patch.logo_path = null;
  } else if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_EXT[logo.type];
    if (!ext) throw new Error("Logo must be PNG, SVG, WebP or JPG");
    if (logo.size > 1_000_000) throw new Error("Logo must be under 1 MB");
    const path = `${cur?.slug ?? orgId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, Buffer.from(await logo.arrayBuffer()), { contentType: logo.type, upsert: true });
    if (error) throw new Error(error.message);
    patch.logo_path = path;
  }
  const { error } = await supabase.from("organisations").update(patch).eq("id", orgId);
  if (error) throw new Error(error.message);
  if ("logo_path" in patch && cur?.logo_path && cur.logo_path !== patch.logo_path) await supabase.storage.from("branding").remove([cur.logo_path]);
  revalidatePath("/settings"); revalidatePath("/", "layout");
}

export async function sendTestChat(orgId: string, channel: "chat" | "slack" = "chat") {
  const { supabase, user } = await requireCoreAdmin();
  const { data: o } = await supabase.from("organisations").select("chat_webhook_url,slack_webhook_url,name").eq("id", orgId).maybeSingle();
  const hook = channel === "slack" ? o?.slack_webhook_url : o?.chat_webhook_url;
  if (!hook) throw new Error("Save a webhook URL first");
  const { postChat, chat } = await import("@/lib/chat"); const { appUrl } = await import("@/lib/email");
  const r = await postChat(hook, `${chat.bold(`Design & Concur is connected to ${o!.name}.`)} Test sent by ${user.name ?? user.email}.\n${chat.link(appUrl("/events"), "Open Design & Concur")}`);
  if ("error" in r) throw new Error(r.error);
}

export async function sendTestEmail() {
  const { user } = await requireCoreAdmin();
  const { sendEmail, appUrl, emailConfigured } = await import("@/lib/email");
  if (!emailConfigured()) throw new Error("RESEND_API_KEY and EMAIL_FROM are not set on Vercel yet");
  const r = await sendEmail(user.email, "Design & Concur test email", { heading: "Email is working", body: `Sent to ${user.email} from the Settings page.`, cta: { label: "Open Design & Concur", href: appUrl("/events") } });
  if ("error" in r) throw new Error(r.error);
}

/** Undo a soft delete within the restore window (PRD §8). Core Admins only. */
export async function restoreEvent(eventId: string) {
  const { supabase, user, org } = await requireCoreAdmin();
  const { data: event } = await supabase.from("events").select("id,org_id,title,status,deleted_at").eq("id", eventId).maybeSingle();
  if (!event || event.org_id !== org.id || !event.deleted_at) throw new Error("Nothing to restore");
  if (Date.now() - new Date(event.deleted_at).getTime() > DELETE_RESTORE_DAYS * 86400_000) throw new Error("The restore window has passed");
  if (event.status === "active") {
    const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
    if ((count ?? 0) >= EVENT_CAP) throw new Error(`All ${EVENT_CAP} event slots are in use; free one before restoring.`);
  }
  await supabase.from("events").update({ deleted_at: null }).eq("id", event.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, actor_id: user.id, kind: "event.restored", payload: { title: event.title } });
  revalidatePath("/archive"); revalidatePath("/events");
}
