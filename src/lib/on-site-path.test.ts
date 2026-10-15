import test from "node:test";
import assert from "node:assert/strict";
import { isOnSitePath } from "./on-site-path.ts";

test("only a plain on-site path is accepted", () => {
  for (const ok of ["/events", "/events/abc/slots/def?x=1#y", "/"]) assert.equal(isOnSitePath(ok), true, ok);
  for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "events", "/a\nb", "/a\tb", "", null, undefined, 5]) assert.equal(isOnSitePath(bad), false, String(bad));
});
