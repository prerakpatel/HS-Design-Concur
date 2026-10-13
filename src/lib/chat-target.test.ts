import test from "node:test";
import assert from "node:assert/strict";
import { parseChatTarget } from "./chat-target.ts";

test("a Slack channel link or ID becomes the channel", () => {
  assert.deepEqual(parseChatTarget("https://harisumiran.slack.com/archives/C07ABC12345"), { target: "slack:C07ABC12345", platform: "slack", kind: "channel" });
  assert.deepEqual(parseChatTarget(" https://app.slack.com/archives/G0123ABCD?x=1 "), { target: "slack:G0123ABCD", platform: "slack", kind: "channel" });
  assert.equal(parseChatTarget("C07ABC12345")?.target, "slack:C07ABC12345");
});
test("webhooks are kept as they are", () => {
  assert.equal(parseChatTarget("https://hooks.slack.com/services/T0/B0/xyz")?.kind, "webhook");
  assert.equal(parseChatTarget("https://chat.googleapis.com/v1/spaces/AAAA/messages?key=k&token=t")?.platform, "gchat");
});
test("anything else is refused", () => {
  assert.equal(parseChatTarget("https://example.com/archives/C07ABC12345"), null);
  assert.equal(parseChatTarget("#design"), null);
  assert.equal(parseChatTarget("https://chat.google.com/room/AAAA"), null);
});
