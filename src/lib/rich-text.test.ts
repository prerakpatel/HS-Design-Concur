import test from "node:test";
import assert from "node:assert/strict";
import { htmlToChat } from "./rich-text.ts";

const noMention = () => "";
test("typed angle brackets never become chat pings or links", () => {
  assert.equal(htmlToChat("<p>hi &lt;users/all&gt;</p>", "gchat", noMention), "hi ‹users/all›");
  assert.equal(htmlToChat("<p>hi &lt;!channel&gt;</p>", "slack", noMention), "hi &lt;!channel&gt;");
  assert.equal(htmlToChat("plain <!channel> text", "slack", noMention), "plain &lt;!channel&gt; text");
  assert.equal(htmlToChat("plain <users/all> text", "gchat", noMention), "plain ‹users/all› text");
});
test("links keep working but cannot break out of their markup", () => {
  const out = htmlToChat('<p><a href="https://a.com/x|y>z">go</a></p>', "slack", noMention);
  assert.equal(out, "<https://a.com/x%7Cy%3Ez|go>");
});
