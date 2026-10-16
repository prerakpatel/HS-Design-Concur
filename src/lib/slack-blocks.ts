/**
 * Slack "Block Kit" messages for the personal reminder, and how a message changes after a button is pressed.
 * Pure functions (no network), so they are tested without Slack.
 */
export interface ReminderItem { commentId: string; title: string; format: string; excerpt: string; url: string }
export interface SlackBlock { type: string; block_id?: string; text?: { type: string; text: string }; accessory?: { type: string; action_id?: string; value?: string }; elements?: unknown[] }

export const MARK_DONE = "mark_done";
export const TEST_PING = "test_ping";
export const MAX_REMINDER_ITEMS = 8;

/** Slack reads &, < and > in message text as markup: anything typed by a person is escaped first. */
export const slackText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function reminderBlocks(items: ReminderItem[], more: number, openUrl: string): SlackBlock[] {
  const shown = items.slice(0, MAX_REMINDER_ITEMS);
  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: shown.length === 1 && !more ? "✅ A change is waiting on you" : "✅ Changes are waiting on you" } },
    { type: "context", elements: [{ type: "mrkdwn", text: "When you have handled one, tap *Mark as done* so nobody wonders what is still open." }] },
  ];
  for (const it of shown) {
    const label = slackText(`${it.title} · ${it.format}`);
    blocks.push({
      type: "section", block_id: `c_${it.commentId}`,
      text: { type: "mrkdwn", text: `*<${it.url}|${label}>*\n${it.excerpt ? `“${slackText(clip(it.excerpt, 160))}”` : "_(no text)_"}` },
      accessory: { type: "button", action_id: MARK_DONE, value: it.commentId, text: { type: "plain_text", text: "Mark as done" }, style: "primary" } as SlackBlock["accessory"],
    });
  }
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `${more > 0 ? `and ${more} more · ` : ""}<${openUrl}|Open Design & Concur>` }] });
  return blocks;
}

/** The message after one comment was marked done: its button becomes a struck-through line; with none left, the header says so. */
export function markDoneBlocks(blocks: SlackBlock[], commentId: string, note = "marked done"): SlackBlock[] {
  const out = blocks.map((b) => {
    if (b.type !== "section" || b.accessory?.value !== commentId) return b;
    const first = (b.text?.text ?? "").split("\n")[0].replace(/^\*(.*)\*$/, "$1");
    return { type: "section", block_id: b.block_id, text: { type: "mrkdwn", text: `✅ ~${first}~ · ${note}` } } as SlackBlock;
  });
  const waiting = out.some((b) => b.type === "section" && b.accessory?.action_id === MARK_DONE);
  return waiting ? out : out.map((b) => (b.type === "header" ? { type: "header", text: { type: "plain_text", text: "🎉 All done, thank you" } } : b)).filter((b) => !(b.type === "context" && JSON.stringify(b).includes("Mark as done")));
}

/** A one-button message an admin can send themselves to check the whole chain works (Core Admins: /api/slack/test-dm). */
export function testBlocks(): SlackBlock[] {
  return [
    { type: "header", text: { type: "plain_text", text: "🔧 Design & Concur button test" } },
    { type: "section", text: { type: "mrkdwn", text: "Tap the button. If it turns into a green tick, buttons in Slack are working." }, accessory: { type: "button", action_id: TEST_PING, value: "test", text: { type: "plain_text", text: "Test button" } } as SlackBlock["accessory"] },
  ];
}
export const testDoneBlocks = (name: string): SlackBlock[] => [
  { type: "header", text: { type: "plain_text", text: "🔧 Design & Concur button test" } },
  { type: "section", text: { type: "mrkdwn", text: `✅ Connected. Slack account matched to *${slackText(name)}*. Buttons will work.` } },
];
