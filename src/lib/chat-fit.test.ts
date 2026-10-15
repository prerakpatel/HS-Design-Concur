import test from "node:test";
import assert from "node:assert/strict";
import { fitChat } from "./chat-fit.ts";
import { mentionsToken } from "./mention-match.ts";

test("a short post is left alone", () => assert.equal(fitChat("hello\nworld", 100), "hello\nworld"));

test("a long post is cut but keeps its headline and its link line", () => {
  const post = ["*Headline*", "x".repeat(5000), "<https://hsdesign.vercel.app/open?to=1|Open in Design & Concur>"].join("\n");
  const out = fitChat(post, 2900);
  assert.ok(out.length <= 2900, String(out.length));
  assert.ok(out.startsWith("*Headline*"));
  assert.ok(out.endsWith("|Open in Design & Concur>"));
  assert.ok(out.includes("…\n"));
});

test("a long single line is cut with an ellipsis", () => {
  const out = fitChat("y".repeat(5000), 100);
  assert.equal(out.length, 100);
  assert.ok(out.endsWith("…"));
});

test("@name matches as a whole word only", () => {
  assert.equal(mentionsToken("thanks @bob!", "bob"), true);
  assert.equal(mentionsToken("@Bob can you check", "bob"), true);
  assert.equal(mentionsToken("write to bob@gmail.com", "gmail"), false);
  assert.equal(mentionsToken("write to bob@gmail.com", "bob"), false);
  assert.equal(mentionsToken("hi @gmail.com", "g"), false);
  assert.equal(mentionsToken("hi @alexander", "alex"), false);
  assert.equal(mentionsToken("hi @alex, and @alex.", "alex"), true);
  assert.equal(mentionsToken("anything", ""), false);
});
