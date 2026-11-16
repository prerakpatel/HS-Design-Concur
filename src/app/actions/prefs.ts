"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { normaliseSlackId, postChat, chat, mention, platformOf } from "@/lib/chat";
import { appUrl } from "@/lib/email";
import { UserError } from "@/lib/user-error";

export async function updateEmailPref(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const pref = String(formData.get("email_pref"));
  if (!["instant", "digest", "off"].includes(pref)) throw new UserError("Unknown preference");
  await supabase.from("users").update({ email_pref: pref }).eq("id", user.id);
  revalidatePath("/inbox");
}

/** Personal reminders: on, snoozed for a while, or off. */
export async function updateReminderPrefs(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const choice = String(formData.get("reminders"));
  const days = { "snooze-7": 7, "snooze-30": 30 }[choice];
  if (!["on", "off"].includes(choice) && !days) throw new UserError("Unknown choice");
  const until = days ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10) : null;
  const { error } = await supabase.from("users").update({ reminders_enabled: choice !== "off", reminders_snooze_until: until }).eq("id", user.id);
  if (error) throw new UserError(error.message);
  revalidatePath("/inbox");
}

/** Your own Slack member ID, so chat posts can @-mention you. Google Chat links itself from your Google sign-in. */
export async function updateChatHandles(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const slack_user_id = normaliseSlackId(String(formData.get("slack_user_id") ?? ""));
  const { error } = await supabase.from("users").update({ slack_user_id }).eq("id", user.id);
  if (error) throw new UserError(error.message);
  revalidatePath("/profile");
}

/** Posts a hello that @-mentions you in the current organization's chat(s), to check the handle works. */
export async function sendTestMention() {
  const { supabase, user, org } = await requireActiveUser();
  // The session's organisation leaves the webhook URLs out (they must not reach the browser), so read them here.
  const { data: hookRow } = await supabase.from("organisations").select("chat_webhook_url,slack_webhook_url").eq("id", org.id).maybeSingle();
  const hooks = [org.chat_enabled && hookRow?.chat_webhook_url, org.slack_enabled && hookRow?.slack_webhook_url].filter((h): h is string => !!h);
  if (hooks.length === 0) throw new UserError(`${org.short_name} has no chat webhook yet. A Core Admin sets one in Settings → Organizations.`);
  const results = await Promise.all(hooks.map((h) => postChat(h, `👋 ${mention(user, platformOf(h))} this is your test mention from Design & Concur.\n${chat.link(appUrl("/profile"), "Open your profile")}`)));
  const errors = results.filter((r): r is { error: string } => "error" in r);
  if (errors.length) throw new UserError(errors[0].error);
}
