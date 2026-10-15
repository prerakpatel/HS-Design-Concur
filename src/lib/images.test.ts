import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processUpload } from "./images.ts";

test("a PNG declared as a GIF is refused; a real GIF passes through untouched", async () => {
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c00" } }).png().toBuffer();
  await assert.rejects(processUpload(png, "image/gif"), /not a GIF/);
  const gif = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#0a0" } }).gif().toBuffer();
  const out = await processUpload(gif, "image/gif");
  assert.equal(out.optimised.mime, "image/gif");
  assert.equal(out.width, 40);
});
