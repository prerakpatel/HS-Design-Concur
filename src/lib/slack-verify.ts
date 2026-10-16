import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Slack signs every request it sends to the app (docs.slack.dev: "Verifying requests from Slack"): an HMAC-SHA256 of
 * `v0:<timestamp>:<raw body>` with the app's signing secret, sent as `v0=<hex>`. A request that is not signed with the
 * secret, or is older than five minutes (a replay), is refused.
 */
export function verifySlackSignature(secret: string, timestamp: string | null, signature: string | null, rawBody: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 60 * 5) return false;
  const expected = Buffer.from("v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex"));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
