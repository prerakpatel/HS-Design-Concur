import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { reminderBlocks, markDoneBlocks, slackText, MARK_DONE, type ReminderItem } from "./slack-blocks.ts";
import { verifySlackSignature } from "./slack-verify.ts";
import { assetBullet } from "./chat-bullets.ts";

const item = (n: number): ReminderItem => ({ commentId: `00000000-0000-0000-0000-00000000000${n}`, title: `Event ${n}`, format: "Mobile", excerpt: `Please fix <b>${n}</b> & more`, url: `https://hsdesign.vercel.app/open?org=harisumiran&to=%2Fevents%2F${n}` });

test("the reminder has one Mark as done button per change, each carrying its comment id", () => {
  const blocks = reminderBlocks([item(1), item(2)], 0, "https://hsdesign.vercel.app/inbox");
  const buttons = blocks.filter((b) => b.accessory?.action_id === MARK_DONE);
  assert.deepEqual(buttons.map((b) => b.accessory!.value), [item(1).commentId, item(2).commentId]);
  assert.equal(blocks[0].type, "header");
});

test("typed text cannot become Slack markup in the reminder", () => {
  const text = reminderBlocks([item(1)], 0, "x").find((b) => b.type === "section")!.text!.text;
  assert.ok(!text.includes("<b>"), text);
  assert.ok(text.includes("&lt;b&gt;1&lt;/b&gt; &amp; more"), text);
  assert.equal(slackText("a<b>&"), "a&lt;b&gt;&amp;");
});

test("at most eight changes are listed, and the rest are counted", () => {
  const many = Array.from({ length: 12 }, (_, i) => item(i % 9));
  const blocks = reminderBlocks(many, 4, "https://x/inbox");
  assert.equal(blocks.filter((b) => b.type === "section").length, 8);
  assert.ok(JSON.stringify(blocks[blocks.length - 1]).includes("and 4 more"));
});

test("pressing a button strikes that line through and keeps the others", () => {
  const before = reminderBlocks([item(1), item(2)], 0, "https://x/inbox");
  const after = markDoneBlocks(before, item(1).commentId);
  assert.equal(after.filter((b) => b.accessory?.action_id === MARK_DONE).length, 1);
  assert.ok(JSON.stringify(after).includes("✅ ~"));
  assert.equal(after[0].text!.text, before[0].text!.text); // header unchanged while one is left
});

test("when the last one is done the message says everything is done and drops the instruction", () => {
  let blocks = reminderBlocks([item(1), item(2)], 0, "https://x/inbox");
  blocks = markDoneBlocks(markDoneBlocks(blocks, item(1).commentId), item(2).commentId);
  assert.equal(blocks.filter((b) => b.accessory?.action_id === MARK_DONE).length, 0);
  assert.ok(JSON.stringify(blocks[0]).includes("All done"));
  assert.ok(!JSON.stringify(blocks).includes("Mark as done"));
});

test("only a request signed with the app's secret, in the last five minutes, is accepted", () => {
  const secret = "s3cret"; const body = "payload=%7B%7D"; const now = 1_800_000_000; const ts = String(now);
  const sig = "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
  assert.equal(verifySlackSignature(secret, ts, sig, body, now), true);
  assert.equal(verifySlackSignature(secret, ts, sig, body + "x", now), false);            // body changed
  assert.equal(verifySlackSignature("other", ts, sig, body, now), false);                  // wrong secret
  assert.equal(verifySlackSignature(secret, ts, sig, body, now + 301), false);             // replayed later
  assert.equal(verifySlackSignature(secret, ts, "v0=abc", body, now), false);              // wrong length
  assert.equal(verifySlackSignature(secret, null, sig, body, now), false);
  assert.equal(verifySlackSignature("", ts, sig, body, now), false);
});

test("a channel post lists each asset as a link, in Slack and Google Chat markup alike", () => {
  assert.equal(assetBullet({ title: "Diwali", format: "Mobile", open: 3, url: "https://h/x" }), "• <https://h/x|Diwali · Mobile>: 3 open changes");
  assert.equal(assetBullet({ title: "Diwali", format: "Mobile", open: 1 }), "• Diwali · Mobile: 1 open change");
  assert.equal(assetBullet({ title: "A|B>", format: "C", open: 2, url: "https://h" }), "• <https://h|AB · C>: 2 open changes");
});
