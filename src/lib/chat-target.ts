/** A project's Slack channel is stored as this prefix + the channel ID; the app's bot posts there. */
export const SLACK_CHANNEL = "slack:";

/**
 * What someone pasted to connect a project's chat: a Slack channel link (or ID), a Slack webhook, or a Google Chat
 * webhook. Returns the stored target, or null when it is none of these.
 */
export function parseChatTarget(raw: string): { target: string; platform: "slack" | "gchat"; kind: "channel" | "webhook" } | null {
  const s = raw.trim();
  if (/^https:\/\/hooks\.slack\.com\/services\/\S+$/.test(s)) return { target: s, platform: "slack", kind: "webhook" };
  if (/^https:\/\/chat\.googleapis\.com\/v1\/spaces\/[^/]+\/messages\?\S+$/.test(s)) return { target: s, platform: "gchat", kind: "webhook" };
  const id = s.match(/^https:\/\/[\w.-]*slack\.com\/archives\/([CG][A-Z0-9]{6,})(?:[/?#]\S*)?$/)?.[1] ?? s.match(/^([CG][A-Z0-9]{6,})$/)?.[1];
  return id ? { target: SLACK_CHANNEL + id, platform: "slack", kind: "channel" } : null;
}
