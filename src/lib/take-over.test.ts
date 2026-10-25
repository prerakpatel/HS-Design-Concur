import test from "node:test";
import assert from "node:assert/strict";
import { takesOver } from "./take-over.ts";

test("an empty asset goes to whoever uploads, even an approver", () => {
  assert.equal(takesOver({ uploader: "a", assignee: null, privileged: false }), true);
  assert.equal(takesOver({ uploader: "a", assignee: null, privileged: true }), true);
});
test("a designer uploading to someone else's asset takes it; the assigned designer keeps it", () => {
  assert.equal(takesOver({ uploader: "a", assignee: "b", privileged: false }), true);
  assert.equal(takesOver({ uploader: "a", assignee: "a", privileged: false }), false);
});
test("a Core Admin or approver never takes an asset from its assignee", () => {
  assert.equal(takesOver({ uploader: "a", assignee: "b", privileged: true }), false);
});
