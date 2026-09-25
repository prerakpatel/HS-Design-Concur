import type { SupabaseClient } from "@supabase/supabase-js";
import { RELEASES } from "@/config/changelog";
import { postChat, chat } from "@/lib/chat";
import { appUrl } from "@/lib/email";

/**
 * Announce a release in every organization's Google Chat space / Slack channel, once. Returns what happened so
 * the caller (the daily job, or a Core Admin's "Share in chat" button) can report it.
 */
export async function postRelease(db: SupabaseClient, releaseId: string, postedBy?: string): Promise<{ posted: boolean; reason?: string }> {
  const release = RELEASES.find((r) => r.id === releaseId);
  if (!release) return { posted: false, reason: "Unknown release" };
  const { data: already } = await db.from("changelog_posts").select("release_id").eq("release_id", releaseId).maybeSingle();
  if (already) return { posted: false, reason: "Already shared" };
  const { data: orgs } = await db.from("organisations").select("chat_enabled,chat_webhook_url,slack_enabled,slack_webhook_url");
  const hooks = [...new Set((orgs ?? []).flatMap((o) => [o.chat_enabled && o.chat_webhook_url, o.slack_enabled && o.slack_webhook_url]).filter((h): h is string => !!h))];
  if (hooks.length === 0) return { posted: false, reason: "No chat webhook is set up yet" };
  const text = [chat.bold(`✨ What's new in Design & Concur · ${release.title}`), ...release.items.map((i) => `• ${i}`), chat.link(appUrl("/events?whats-new=1"), "Open Design & Concur")].join("\n");
  const results = await Promise.all(hooks.map((h) => postChat(h, text)));
  const failed = results.filter((r): r is { error: string } => "error" in r);
  if (failed.length === results.length) return { posted: false, reason: failed[0].error };
  await db.from("changelog_posts").insert({ release_id: releaseId, posted_by: postedBy ?? null });
  return { posted: true };
}
