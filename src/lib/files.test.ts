import test from "node:test";
import assert from "node:assert/strict";

process.env.R2_ACCOUNT_ID = "acct"; process.env.R2_ACCESS_KEY_ID = "AKIDEXAMPLE"; process.env.R2_SECRET_ACCESS_KEY = "secret"; process.env.R2_BUCKET = "bucket";
const { signedUrl, newPath, isR2, uploadTarget } = await import("./files.ts");
const none = null as never;

test("new files go to R2 once it is configured, marked r2:", () => {
  assert.equal(newPath("org/ev/slot/v1/front/thumb.webp"), "r2:org/ev/slot/v1/front/thumb.webp");
  assert.equal(isR2("r2:x"), true); assert.equal(isR2("org/x"), false);
});
test("an R2 view link is signed locally and stays the same within the hour (browser cache)", async () => {
  const a = await signedUrl(none, "r2:org/ev/slot/v1/front/thumb.webp");
  const b = await signedUrl(none, "r2:org/ev/slot/v1/front/thumb.webp");
  assert.equal(a, b);
  const u = new URL(a!);
  assert.equal(u.host, "acct.r2.cloudflarestorage.com");
  assert.equal(u.pathname, "/bucket/org/ev/slot/v1/front/thumb.webp");
  assert.equal(u.searchParams.get("X-Amz-Expires"), String(600 + 3600));
  assert.ok(u.searchParams.get("X-Amz-Signature"));
});
test("a download link names the file; a 7-day chat link stays within R2's maximum", async () => {
  const d = new URL((await signedUrl(none, "r2:a/b.jpg", 120, 'Diwali "IG".jpg'))!);
  assert.equal(d.searchParams.get("response-content-disposition"), 'attachment; filename="Diwali IG.jpg"');
  const week = new URL((await signedUrl(none, "r2:a/b.jpg", 7 * 24 * 3600))!);
  assert.equal(week.searchParams.get("X-Amz-Expires"), String(7 * 24 * 3600));
});
test("an upload target is a signed PUT link for R2 paths", async () => {
  const t = await uploadTarget(none, "r2:tmp/slot/file.png");
  assert.equal(t.kind, "r2");
  assert.ok(new URL(t.url).searchParams.get("X-Amz-Signature"));
});
