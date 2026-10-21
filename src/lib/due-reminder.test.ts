import test from "node:test";
import assert from "node:assert/strict";
import { dueProjects, dueChatBody, type DueSlot } from "./due-reminder.ts";
import { dueBlocks } from "./slack-blocks.ts";

const d = (n: number, event: string, when: "today" | "3d", assignee: string | null = "u1"): DueSlot => ({ slotId: `s${n}`, eventId: event, orgId: "o", title: `Event ${event}`, format: `F${n}`, assignee, due: "2026-10-21", when, url: `https://x/${n}` });

test("the channel lists each project once with its counts, today first, and never a name", () => {
  const ps = dueProjects([d(1, "a", "3d"), d(2, "b", "today"), d(3, "b", "today"), d(4, "b", "3d", null)], (s) => `https://x/e/${s.eventId}`);
  assert.deepEqual(ps.map((p) => [p.eventId, p.today, p.soon]), [["b", 2, 1], ["a", 0, 1]]);
  const body = dueChatBody(ps, 2, "in 3 days");
  assert.equal(body, "• <https://x/e/b|Event b>: 2 due today, 1 due in 3 days\n• <https://x/e/a|Event a>: 1 due in 3 days");
  assert.ok(!body.includes("@"));
});

test("seven assets of one project are one line", () => {
  const ps = dueProjects(Array.from({ length: 7 }, (_, i) => d(i, "a", "today")), (s) => s.url);
  assert.equal(ps.length, 1);
  assert.equal(dueChatBody(ps, 1, "in 3 days").split("\n").length, 1);
});

test("a due list in a personal message is one message with a divider only when bundled", () => {
  const items = [{ title: "T", format: "F", url: "https://x/1", when: "due today" }];
  assert.ok(dueBlocks(items, 0, "https://x/inbox", true).some((b) => b.type === "divider"));
  assert.ok(!dueBlocks(items, 0, "https://x/inbox", false).some((b) => b.type === "divider"));
});
