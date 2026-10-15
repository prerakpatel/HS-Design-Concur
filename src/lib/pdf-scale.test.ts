import test from "node:test";
import assert from "node:assert/strict";
import { pdfScale, MAX_RASTER_PIXELS, MAX_RASTER_SIDE } from "./pdf-scale.ts";

test("an ordinary print page is drawn at 150 dpi", () => {
  assert.equal(pdfScale(612, 792), 150 / 72);             // US Letter
  assert.equal(pdfScale(14 * 72, 8.5 * 72), 150 / 72);    // a calendar cover
});

test("a huge page is drawn smaller so it fits in memory", () => {
  const banner = pdfScale(36 * 72, 96 * 72)!;             // a 3 x 8 ft banner
  assert.ok(banner < 150 / 72);
  assert.ok(36 * 72 * banner * (96 * 72 * banner) <= MAX_RASTER_PIXELS * 1.001);
  const claimsHuge = pdfScale(14_400, 14_400)!;            // a tiny file that says its paper is 200 inches square
  assert.ok(14_400 * claimsHuge * (14_400 * claimsHuge) <= MAX_RASTER_PIXELS * 1.001);
  assert.ok(14_400 * claimsHuge <= MAX_RASTER_SIDE);
});

test("a long thin page is limited by its longest side", () => {
  const s = pdfScale(72, 72 * 400)!;                       // 1 x 400 inches
  assert.ok(72 * 400 * s <= MAX_RASTER_SIDE * 1.001);
});

test("a page without a usable size is refused", () => {
  for (const [w, h] of [[0, 100], [100, 0], [NaN, 5], [Infinity, 5], [-3, 8]]) assert.equal(pdfScale(w, h), null);
});
