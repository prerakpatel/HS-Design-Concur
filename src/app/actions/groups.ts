"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { UserError } from "@/lib/user-error";
import type { GroupHears } from "@/lib/groups";

async function requireCoreAdmin() {
  const ctx = await requireActiveUser();
  if (ctx.user.role !== "core_admin") throw new UserError("Core Admins only");
  return ctx;
}

function readGroupForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new UserError("Give the group a name");
  const hears = String(formData.get("hears") ?? "own") as GroupHears;
  if (!["all", "own", "milestones"].includes(hears)) throw new UserError("Unknown setting");
  const chat_webhook_url = String(formData.get("chat_webhook_url") ?? "").trim() || null;
  const slack_webhook_url = String(formData.get("slack_webhook_url") ?? "").trim() || null;
  if (chat_webhook_url && !/^https:\/\/chat\.googleapis\.com\//.test(chat_webhook_url)) throw new UserError("The Google Chat webhook should start with https://chat.googleapis.com/");
  if (slack_webhook_url && !/^https:\/\/hooks\.slack\.com\//.test(slack_webhook_url)) throw new UserError("The Slack webhook should start with https://hooks.slack.com/");
  const members = [...new Set(formData.getAll("member").map(String).filter(Boolean))];
  return { name, hears, chat_webhook_url, slack_webhook_url, members };
}

/** Create or update a group (Core Admin). `groupId` null creates one in the current organization. */
export async function saveGroup(groupId: string | null, formData: FormData) {
  const { supabase, org } = await requireCoreAdmin();
  const f = readGroupForm(formData);
  let id = groupId;
  if (id) {
    const { error } = await supabase.from("groups").update({ name: f.name, hears: f.hears, chat_webhook_url: f.chat_webhook_url, slack_webhook_url: f.slack_webhook_url }).eq("id", id).eq("org_id", org.id);
    if (error) throw new UserError(error.message.includes("unique") ? "A group with that name already exists" : error.message);
  } else {
    const { data, error } = await supabase.from("groups").insert({ org_id: org.id, name: f.name, hears: f.hears, chat_webhook_url: f.chat_webhook_url, slack_webhook_url: f.slack_webhook_url }).select("id").single();
    if (error || !data) throw new UserError(error?.message.includes("unique") ? "A group with that name already exists" : error?.message ?? "Could not create the group");
    id = data.id;
  }
  await supabase.from("group_members").delete().eq("group_id", id);
  if (f.members.length) { const { error } = await supabase.from("group_members").insert(f.members.map((user_id) => ({ group_id: id, user_id }))); if (error) throw new UserError(error.message); }
  revalidatePath("/settings");
}

export async function deleteGroup(groupId: string) {
  const { supabase, org } = await requireCoreAdmin();
  const { error } = await supabase.from("groups").delete().eq("id", groupId).eq("org_id", org.id);
  if (error) throw new UserError(error.message);
  revalidatePath("/settings");
}

/** Posts a hello to one of the group's webhooks. */
export async function testGroupChat(groupId: string, platform: "chat" | "slack") {
  const { supabase, user, org } = await requireCoreAdmin();
  const { data: g } = await supabase.from("groups").select("name,chat_webhook_url,slack_webhook_url").eq("id", groupId).eq("org_id", org.id).maybeSingle();
  const hook = platform === "slack" ? g?.slack_webhook_url : g?.chat_webhook_url;
  if (!g || !hook) throw new UserError("Save a webhook URL for this group first");
  const { postChat, chat } = await import("@/lib/chat"); const { appUrl } = await import("@/lib/email");
  const r = await postChat(hook, `${chat.bold(`Design & Concur is connected to the ${g.name} group.`)} Test sent by ${user.name ?? user.email}.\n${chat.link(appUrl("/events"), "Open Design & Concur")}`);
  if ("error" in r) throw new UserError(String(r.error));
}
