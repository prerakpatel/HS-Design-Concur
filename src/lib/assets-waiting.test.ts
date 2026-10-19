import test from "node:test";
import assert from "node:assert/strict";
import { splitWaiting, waitingProjects, waitingChatSection, type WaitingSlot } from "./assets-waiting.ts";
import { waitingBlocks, reminderBlocks, markDoneBlocks } from "./slack-blocks.ts";

const slot = (n: number, event: string, assignee: string | null): WaitingSlot => ({ slotId: `s${n}`, eventId: event, orgId: "o", title: `Event ${event}`, format: `Format ${n}`, assignee, url: `https://x/${n}` });

test("assigned items go to their active assignee; the rest are unassigned", () => {
  const { byPerson, unassigned } = splitWaiting([slot(1, "a", "u1"), slot(2, "a", "u1"), slot(3, "b", null), slot(4, "b", "gone")], new Set(["u1"]));
  assert.equal(byPerson.get("u1")?.length, 2);
  assert.deepEqual(unassigned.map((s) => s.slotId), ["s3", "s4"]);
});

test("the channel lists each project once, busiest first", () => {
  const ps = waitingProjects([slot(1, "a", null), slot(2, "b", null), slot(3, "b", null)], (s) => `https://x/e/${s.eventId}`);
  assert.deepEqual(ps.map((p) => [p.eventId, p.count]), [["b", 2], ["a", 1]]);
  const text = waitingChatSection(ps, 3, true);
  assert.match(text, /^──────────\n📥 Waiting on assets\n• <https:\/\/x\/e\/b\|Event b>: 2 assets waiting\n• <https:\/\/x\/e\/a\|Event a>: 1 asset waiting/);
  assert.ok(!waitingChatSection(ps, 3, false).includes("──────────"));
});

test("a bundled personal message puts a divider between the two parts, and marking changes done leaves the assets part alone", () => {
  const rem = reminderBlocks([{ commentId: "c1", title: "T", format: "F", excerpt: "x", url: "https://x" }], 0, "https://x/inbox");
  const all = [...rem, ...waitingBlocks([{ title: "T", format: "F", url: "https://x/1" }], 0, "https://x/inbox", true)];
  assert.ok(all.some((b) => b.type === "divider"));
  const done = markDoneBlocks(all, "c1");
  const headers = done.filter((b) => b.type === "header").map((b) => b.text?.text);
  assert.deepEqual(headers, ["🎉 All done, thank you", "📥 Waiting on your assets"]);
});
