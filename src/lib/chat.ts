export interface ChatImage { url: string; alt: string; href: string }
import { UserError } from "@/lib/user-error";
import { fitChat, CHAT_BLOCK_LIMIT, CHAT_TEXT_LIMIT } from "@/lib/chat-fit";

/**
 * Post to a chat target: a Google Chat or Slack incoming webhook URL, or `slack:<channel id>` for a channel the
 * Slack app was invited to (a project's own channel). All take { text } with the same *bold* and <url|label>
 * markup; with an `image`, Slack gets a Block Kit section + image and Google Chat a card under the text, both
 * linking to `href`. Failures are returned, never thrown.
 */
export async function postChat(webhookUrl: string, rawText: string, image?: ChatImage | null) {
  // A long comment must not make the whole post fail (Slack refuses a text block over 3000 characters).
  const text = fitChat(rawText, image && platformOf(webhookUrl) === "slack" ? CHAT_BLOCK_LIMIT : CHAT_TEXT_LIMIT);
  const body: Record<string, unknown> = { text };
  if (image) {
    if (platformOf(webhookUrl) === "slack") body.blocks = [{ type: "section", text: { type: "mrkdwn", text } }, { type: "image", image_url: image.url, alt_text: image.alt.slice(0, 2000) }];
    else body.cardsV2 = [{ cardId: "preview", card: { sections: [{ widgets: [{ image: { imageUrl: image.url, altText: image.alt, onClick: { openLink: { url: image.href } } } }] }] } }];
  }
  if (webhookUrl.startsWith(SLACK_CHANNEL)) return postSlackChannel(webhookUrl.slice(SLACK_CHANNEL.length), body);
  try {
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200);
      // Slack revokes a webhook when the app is reinstalled or the channel is removed; say what to do, not the code.
      if (/no_service|invalid_token|channel_not_found|channel_is_archived/.test(text)) return { error: "Slack says this webhook no longer works. In the Slack app open Incoming Webhooks, copy the current URL for the channel (reinstalling the app issues new ones), paste it in Settings → Organizations and save." };
      if (res.status === 404 && /chat\.googleapis\.com/.test(webhookUrl)) return { error: "Google Chat says this webhook no longer exists. In the space, open Apps & integrations → Webhooks, copy the current URL, paste it in Settings → Organizations and save." };
      return { error: `Webhook ${res.status}: ${text}` };
    }
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

import { SLACK_CHANNEL } from "@/lib/chat-target";
export { SLACK_CHANNEL, parseChatTarget } from "@/lib/chat-target";

/** Post as the Slack app (bot token, chat:write). Its errors are turned into what to do next. */
async function postSlackChannel(channel: string, body: Record<string, unknown>): Promise<{ ok: true } | { error: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { error: "Slack is not set up for channel links yet (SLACK_BOT_TOKEN is missing). Paste the channel's incoming-webhook URL instead." };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, unfurl_links: false, ...body }) });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (data.ok) return { ok: true };
    if (data.error === "not_in_channel" || data.error === "channel_not_found") return { error: "The Design & Concur app is not in that channel yet. In the channel, type /invite @Design & Concur, then connect again." };
    if (data.error === "missing_scope") return { error: "The Slack app needs one more permission (chat:write) before it can post to project channels. See docs/notifications.md → Project channels." };
    if (data.error === "is_archived") return { error: "That Slack channel is archived." };
    return { error: `Slack said ${data.error ?? res.status}` };
  } catch (e) { return { error: (e as Error).message }; }
}

export type ChatPlatform = "gchat" | "slack";

/** Which platform a chat target belongs to; decides the @mention syntax. */
export function platformOf(webhookUrl: string): ChatPlatform { return webhookUrl.startsWith(SLACK_CHANNEL) || /hooks\.slack\.com/.test(webhookUrl) ? "slack" : "gchat"; }


/** Chat text formatting shared by Google Chat and Slack: *bold*, _italic_, <url|label>. */
export const chat = { bold: (s: string) => `*${s.replace(/\*/g, "")}*`, link: (url: string, label: string) => `<${url}|${label.replace(/[<>|]/g, "")}>` };

/**
 * Text a person typed (a title, a name, a comment) must not become chat markup: `<!channel>`, `<users/all>` and
 * `<https://elsewhere|Click here>` would post a real ping or link. The angle brackets become look-alikes (‹ ›).
 */
export const plainChat = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›");

/** A notification payload with every typed string made safe for chat. Comment HTML (`excerptHtml`, a batch's `items`) is cleaned when it is rendered instead. */
export function chatSafePayload(p: Record<string, unknown>): Record<string, unknown> {
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === "string") return plainChat(v);
    if (Array.isArray(v)) return v.map((x) => (key === "items" && typeof x === "string" ? x : walk(x, key)));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === "excerptHtml" ? v : walk(v, k)]));
}

/** Ping everyone in the channel or space: Slack @channel, Google Chat @all. */
export const everyone = (platform: ChatPlatform) => (platform === "slack" ? "<!channel>" : "<users/all>");

export interface ChatUser { id: string; name: string | null; email: string; slack_user_id: string | null; gchat_user_id: string | null }

/**
 * A real @mention when the person has told us their ID on that platform (Slack member ID, Google account ID),
 * otherwise their name in bold so the message still reads well.
 */
export function mention(u: ChatUser, platform: ChatPlatform) {
  const id = platform === "slack" ? u.slack_user_id : u.gchat_user_id;
  if (id) return platform === "slack" ? `<@${id}>` : `<users/${id}>`;
  return chat.bold(u.name ?? u.email.split("@")[0]);
}

/** Slack member IDs look like U0123ABCD or W0123ABCD. Returns the normalised ID, null to clear, or throws. */
export function normaliseSlackId(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (!/^[UW][A-Z0-9]{6,}$/.test(s)) throw new UserError("A Slack member ID starts with U or W, like U0123ABCD");
  return s;
}
