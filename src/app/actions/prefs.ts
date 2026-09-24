"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { normaliseSlackId, postChat, chat, mention, platformOf } from "@/lib/chat";
import { appUrl } from "@/lib/email";

export async function updateEmailPref(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const pref = String(formData.get("email_pref"));
  if (!["instant", "digest", "off"].includes(pref)) throw new Error("Unknown preference");
  await supabase.from("users").update({ email_pref: pref }).eq("id", user.id);
  revalidatePath("/inbox");
}

/** Your own Slack member ID, so chat posts can @-mention you. Google Chat links itself from your Google sign-in. */
export async function updateChatHandles(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const slack_user_id = normaliseSlackId(String(formData.get("slack_user_id") ?? ""));
  const { error } = await supabase.from("users").update({ slack_user_id }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

/** Posts a hello that @-mentions you in the current organisation's chat(s), to check the handle works. */
export async function sendTestMention() {
  const { user, org } = await requireActiveUser();
  const hooks = [org.chat_enabled && org.chat_webhook_url, org.slack_enabled && org.slack_webhook_url].filter((h): h is string => !!h);
  if (hooks.length === 0) throw new Error(`${org.short_name} has no chat webhook yet. A Core Admin sets one in Settings → Organisations.`);
  const results = await Promise.all(hooks.map((h) => postChat(h, `👋 ${mention(user, platformOf(h))} this is your test mention from Design & Concur.\n${chat.link(appUrl("/profile"), "Open your profile")}`)));
  const errors = results.filter((r): r is { error: string } => "error" in r);
  if (errors.length) throw new Error(errors[0].error);
}
