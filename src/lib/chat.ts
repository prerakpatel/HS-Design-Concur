export interface ChatImage { url: string; alt: string; href: string }

/**
 * Google Chat or Slack incoming webhook. Both take { text } with the same *bold* and <url|label> markup; with an
 * `image`, Slack gets a Block Kit section + image and Google Chat a card under the text, both linking to `href`.
 * Failures are returned, never thrown.
 */
export async function postChat(webhookUrl: string, text: string, image?: ChatImage | null) {
  const body: Record<string, unknown> = { text };
  if (image) {
    if (platformOf(webhookUrl) === "slack") body.blocks = [{ type: "section", text: { type: "mrkdwn", text } }, { type: "image", image_url: image.url, alt_text: image.alt.slice(0, 2000) }];
    else body.cardsV2 = [{ cardId: "preview", card: { sections: [{ widgets: [{ image: { imageUrl: image.url, altText: image.alt, onClick: { openLink: { url: image.href } } } }] }] } }];
  }
  try {
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
    if (!res.ok) return { error: `Webhook ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

export type ChatPlatform = "gchat" | "slack";

/** Which platform a webhook URL belongs to; decides the @mention syntax. */
export function platformOf(webhookUrl: string): ChatPlatform { return /hooks\.slack\.com/.test(webhookUrl) ? "slack" : "gchat"; }

/** Chat text formatting shared by Google Chat and Slack: *bold*, _italic_, <url|label>. */
export const chat = { bold: (s: string) => `*${s.replace(/\*/g, "")}*`, link: (url: string, label: string) => `<${url}|${label.replace(/[<>|]/g, "")}>` };

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
  if (!/^[UW][A-Z0-9]{6,}$/.test(s)) throw new Error("A Slack member ID starts with U or W, like U0123ABCD");
  return s;
}
