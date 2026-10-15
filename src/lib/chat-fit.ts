/** Room in one chat message: Slack's text block holds 3000 characters, Google Chat's text about 4096. */
export const CHAT_BLOCK_LIMIT = 2900;
export const CHAT_TEXT_LIMIT = 3900;

/**
 * Shorten a chat post to fit, keeping its last line (the "Open in Design & Concur" link) and its first (the
 * headline): a long comment is cut in the middle with an ellipsis, instead of the whole post being refused.
 */
export function fitChat(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const lines = text.split("\n");
  const last = lines.length > 1 ? lines[lines.length - 1] : "";
  const room = limit - last.length - (last ? 2 : 1);
  const head = (last ? lines.slice(0, -1) : lines).join("\n").slice(0, Math.max(room, 0)).trimEnd();
  return last ? `${head}…\n${last}` : `${head}…`;
}
