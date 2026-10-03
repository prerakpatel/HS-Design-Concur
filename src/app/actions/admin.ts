"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { normaliseSlackId } from "@/lib/chat";
import { matchSlackIds, slackConfigured } from "@/lib/slack";
import type { FunctionTag } from "@/lib/types";
import { EVENT_CAP, DELETE_RESTORE_DAYS } from "@/config/limits";
import { UserError } from "@/lib/user-error";

async function requireCoreAdmin() {
  const ctx = await requireActiveUser();
  if (ctx.user.role !== "core_admin") throw new UserError("Core Admins only");
  return ctx;
}

async function setMemberships(supabase: Awaited<ReturnType<typeof requireCoreAdmin>>["supabase"], userId: string, orgIds: string[], approverOrgIds: string[]) {
  await supabase.from("org_memberships").delete().eq("user_id", userId);
  if (orgIds.length) await supabase.from("org_memberships").insert(orgIds.map((org_id) => ({ user_id: userId, org_id, is_approver: approverOrgIds.includes(org_id) })));
}

export async function decideAccess(userId: string, formData: FormData) {
  const { supabase, user } = await requireCoreAdmin();
  const approve = formData.get("decision") === "approve";
  const orgIds = formData.getAll("org").map(String);
  if (approve && orgIds.length === 0) throw new UserError("Pick at least one organization");
  await supabase.from("users").update({ status: approve ? "active" : "removed" }).eq("id", userId);
  await supabase.from("access_requests").update({ decided_by: user.id, decided_at: new Date().toISOString(), decision: approve ? "approved" : "denied" }).eq("user_id", userId).is("decided_at", null);
  if (approve) {
    await setMemberships(supabase, userId, orgIds, []);
    const { data: who } = await supabase.from("users").select("name,email").eq("id", userId).maybeSingle();
    await notify(supabase, [userId], "access.approved", { by: user.name ?? user.email, name: who?.name ?? who?.email });
  }
  revalidatePath("/settings");
}

export async function updateUser(userId: string, formData: FormData) {
  const { supabase, user, org } = await requireCoreAdmin();
  const role = formData.get("role") === "core_admin" ? "core_admin" : "member";
  const function_tags = formData.getAll("tag").map(String).filter((t): t is FunctionTag => ["central", "publication", "designer"].includes(t));
  const orgIds = formData.getAll("org").map(String);
  const approverOrgIds = formData.getAll("approver_org").map(String).filter((o) => orgIds.includes(o));
  if (userId === user.id && role !== "core_admin") throw new UserError("You cannot demote yourself");
  if (role !== "core_admin") {
    const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "core_admin").eq("status", "active").neq("id", userId);
    if ((count ?? 0) === 0) throw new UserError("There must be at least one Core Admin");
  }
  const slack_user_id = normaliseSlackId(String(formData.get("slack_user_id") ?? ""));
  const gchat_user_id = String(formData.get("gchat_user_id") ?? "").trim().replace(/^users\//, "") || null;
  if (gchat_user_id && !/^\d{6,}$/.test(gchat_user_id)) throw new UserError("A Google Chat user ID is a long number");
  await supabase.from("users").update({ role, function_tags, slack_user_id, gchat_user_id }).eq("id", userId);
  await setMemberships(supabase, userId, orgIds, approverOrgIds);
  if (formData.get("groups_present")) {
    // Only this organization's groups are on the form; memberships in the other org's groups are left alone.
    const { data: own } = await supabase.from("groups").select("id").eq("org_id", org.id);
    const ownIds = (own ?? []).map((g) => g.id as string);
    const wanted = formData.getAll("group").map(String).filter((g) => ownIds.includes(g));
    if (ownIds.length) await supabase.from("group_members").delete().eq("user_id", userId).in("group_id", ownIds);
    if (wanted.length) await supabase.from("group_members").insert(wanted.map((group_id) => ({ group_id, user_id: userId })));
  }
  revalidatePath("/settings");
}

export async function removeUser(userId: string) {
  const { supabase, user } = await requireCoreAdmin();
  if (userId === user.id) throw new UserError("You cannot remove yourself");
  const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "core_admin").eq("status", "active").neq("id", userId);
  if ((count ?? 0) === 0) throw new UserError("There must be at least one Core Admin");
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
    if (!ext) throw new UserError("Logo must be PNG, SVG, WebP or JPG");
    if (logo.size > 1_000_000) throw new UserError("Logo must be under 1 MB");
    const path = `${cur?.slug ?? orgId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, Buffer.from(await logo.arrayBuffer()), { contentType: logo.type, upsert: true });
    if (error) throw new UserError(error.message);
    patch.logo_path = path;
  }
  const { error } = await supabase.from("organisations").update(patch).eq("id", orgId);
  if (error) throw new UserError(error.message);
  if ("logo_path" in patch && cur?.logo_path && cur.logo_path !== patch.logo_path) await supabase.storage.from("branding").remove([cur.logo_path]);
  revalidatePath("/settings"); revalidatePath("/", "layout");
}

export async function sendTestChat(orgId: string, channel: "chat" | "slack" = "chat") {
  const { supabase, user } = await requireCoreAdmin();
  const { data: o } = await supabase.from("organisations").select("chat_webhook_url,slack_webhook_url,name").eq("id", orgId).maybeSingle();
  const hook = channel === "slack" ? o?.slack_webhook_url : o?.chat_webhook_url;
  if (!hook) throw new UserError("Save a webhook URL first");
  const { postChat, chat } = await import("@/lib/chat"); const { appUrl } = await import("@/lib/email");
  const r = await postChat(hook, `${chat.bold(`Design & Concur is connected to ${o!.name}.`)} Test sent by ${user.name ?? user.email}.\n${chat.link(appUrl("/events"), "Open Design & Concur")}`);
  if ("error" in r) throw new UserError(String(r.error));
}

export async function sendTestEmail() {
  const { user } = await requireCoreAdmin();
  const { sendEmail, appUrl, emailConfigured } = await import("@/lib/email");
  if (!emailConfigured()) throw new UserError("RESEND_API_KEY and EMAIL_FROM are not set on Vercel yet");
  const r = await sendEmail(user.email, "Design & Concur test email", { heading: "Email is working", body: `Sent to ${user.email} from the Settings page.`, cta: { label: "Open Design & Concur", href: appUrl("/events") } });
  if ("error" in r) throw new UserError(String(r.error));
}

/** Undo a soft delete within the restore window (PRD §8). Core Admins only. */
export async function restoreEvent(eventId: string) {
  const { supabase, user, org } = await requireCoreAdmin();
  const { data: event } = await supabase.from("events").select("id,org_id,title,status,deleted_at").eq("id", eventId).maybeSingle();
  if (!event || event.org_id !== org.id || !event.deleted_at) throw new UserError("Nothing to restore");
  if (Date.now() - new Date(event.deleted_at).getTime() > DELETE_RESTORE_DAYS * 86400_000) throw new UserError("The restore window has passed");
  if (event.status === "active") {
    const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
    if ((count ?? 0) >= EVENT_CAP) throw new UserError(`All ${EVENT_CAP} event slots are in use; free one before restoring.`);
  }
  await supabase.from("events").update({ deleted_at: null }).eq("id", event.id);
  await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, actor_id: user.id, kind: "event.restored", payload: { title: event.title } });
  revalidatePath("/archive"); revalidatePath("/events");
}

/** Core Admin: ask Slack for everyone's member ID by email, now rather than at their next sign-in. */
export async function matchSlackMembers() {
  const { supabase } = await requireCoreAdmin();
  if (!slackConfigured()) throw new UserError("Add SLACK_BOT_TOKEN on Vercel first (docs/notifications.md → Slack).");
  const r = await matchSlackIds(supabase);
  revalidatePath("/settings"); revalidatePath("/profile");
  return r;
}
