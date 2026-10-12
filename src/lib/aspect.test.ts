import test from "node:test";
import assert from "node:assert/strict";
import { wholeScale } from "./aspect.ts";

test("exact size is 1x, retina multiples are whole numbers", () => {
  assert.equal(wholeScale(1080, 1350, 1080, 1350), 1);
  assert.equal(wholeScale(2160, 2700, 1080, 1350), 2);
  assert.equal(wholeScale(4320, 5400, 1080, 1350), 4);
});
test("a different shape or an odd multiple is not a clean scale", () => {
  assert.equal(wholeScale(1080, 1080, 1080, 1350), null);
  assert.equal(wholeScale(2000, 2700, 1080, 1350), null);
  assert.equal(wholeScale(5400, 6750, 1080, 1350), null);
  assert.equal(wholeScale(0, 0, 1080, 1350), null);
});
