import type { SlackBlock } from "@/lib/slack-blocks";

/** Buttons need both halves: the bot token to send, and the signing secret to trust the clicks that come back. */
export function slackActionsEnabled() { return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET); }

/**
 * Send a message with blocks as the Slack app. Giving a member's ID as the channel makes it a direct message from the
 * app. Failures are returned, never thrown, with what to do next.
 */
export async function sendSlackBlocks(channel: string, text: string, blocks: SlackBlock[]): Promise<{ ok: true } | { error: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { error: "SLACK_BOT_TOKEN is not set" };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text, blocks, unfurl_links: false, unfurl_media: false }) });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (data.ok) return { ok: true };
    if (data.error === "missing_scope") return { error: "The Slack app needs the im:write permission to send direct messages. See docs/notifications.md → Buttons in Slack." };
    if (data.error === "channel_not_found" || data.error === "user_not_found") return { error: "Slack does not know that member ID." };
    return { error: `Slack said ${data.error ?? res.status}` };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Replace the message a button was pressed in (Slack gives each press a one-time response_url, always on hooks.slack.com). */
export async function replaceSlackMessage(responseUrl: string, text: string, blocks: SlackBlock[]) {
  try {
    if (new URL(responseUrl).hostname !== "hooks.slack.com") return;
    await fetch(responseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace_original: true, text, blocks }) });
  } catch (e) { console.error("[slack actions] could not update the message:", (e as Error).message); }
}

/** A private note only the person who pressed sees. */
export async function whisperSlack(responseUrl: string, text: string) {
  try {
    if (new URL(responseUrl).hostname !== "hooks.slack.com") return;
    await fetch(responseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }) });
  } catch (e) { console.error("[slack actions] could not reply:", (e as Error).message); }
}
