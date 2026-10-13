import { AwsClient } from "aws4fetch";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Asset files live in Cloudflare R2 (new uploads, once the R2_* settings are present) or in Supabase Storage (older
 * files, and everything before R2). A stored path that starts with "r2:" is in R2; any other path is in Supabase's
 * "assets" bucket. Everything that touches asset files goes through here, so both kinds keep working side by side
 * until the Supabase ones age out (files are purged a week after each event).
 *
 * R2 is private: the browser only ever gets short-lived signed links, made here without a network trip. Who may
 * have a link is decided before this is called, by row-level security on the rows the paths come from.
 */
export const BUCKET = "assets";
export const R2 = "r2:";

const env = () => {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: key, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  return account && key && secret && bucket ? { account, key, secret, bucket } : null;
};
export const r2Enabled = () => !!env();
export const isR2 = (path: string) => path.startsWith(R2);

let client: AwsClient | null = null;
function r2() {
  const e = env();
  if (!e) throw new Error("Cloudflare R2 is not configured (R2_* environment variables)");
  client ??= new AwsClient({ accessKeyId: e.key, secretAccessKey: e.secret, service: "s3", region: "auto" });
  return { aws: client, base: `https://${e.account}.r2.cloudflarestorage.com/${e.bucket}`, bucket: e.bucket };
}
const objectUrl = (key: string) => `${r2().base}/${key.split("/").map(encodeURIComponent).join("/")}`;
const keyOf = (path: string) => path.slice(R2.length);

/** Where a new file goes: R2 when it is configured, otherwise Supabase. `path` is the plain <org>/<event>/... path. */
export const newPath = (path: string) => (r2Enabled() ? R2 + path : path);

/** Files never change in place (a new version or a re-stamp gets a new path), so browsers may keep them. */
const CACHE = "private, max-age=31536000, immutable";

export async function writeFile(supabase: SupabaseClient, path: string, body: Buffer, contentType: string): Promise<void> {
  if (isR2(path)) {
    const res = await r2().aws.fetch(objectUrl(keyOf(path)), { method: "PUT", body: new Uint8Array(body), headers: { "Content-Type": contentType, "Cache-Control": CACHE } });
    if (!res.ok) throw new Error(`Could not store the file (R2 ${res.status})`);
    return;
  }
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

export async function readFile(supabase: SupabaseClient, path: string): Promise<Buffer | null> {
  if (isR2(path)) {
    const res = await r2().aws.fetch(objectUrl(keyOf(path)));
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  const { data } = await supabase.storage.from(BUCKET).download(path);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

/** Copy within R2, or across stores (an old Supabase front carried into a new R2 version) by reading and writing. */
export async function copyFile(supabase: SupabaseClient, from: string, to: string): Promise<void> {
  if (isR2(from) && isR2(to)) {
    const { aws, bucket } = r2();
    const res = await aws.fetch(objectUrl(keyOf(to)), { method: "PUT", headers: { "x-amz-copy-source": `/${bucket}/${keyOf(from).split("/").map(encodeURIComponent).join("/")}` } });
    if (!res.ok) throw new Error(`Could not copy the file (R2 ${res.status})`);
    return;
  }
  if (!isR2(from) && !isR2(to)) {
    const { error } = await supabase.storage.from(BUCKET).copy(from, to);
    if (error) throw new Error(error.message);
    return;
  }
  const buf = await readFile(supabase, from);
  if (!buf) throw new Error("The file to copy is missing");
  await writeFile(supabase, to, buf, mimeOf(from));
}

/** Delete files from wherever they are. Missing files are fine. Returns an error message if Supabase refused. */
export async function removeFiles(supabase: SupabaseClient, paths: (string | null | undefined)[]): Promise<string | null> {
  const all = paths.filter((p): p is string => !!p);
  const inR2 = all.filter(isR2); const inSupabase = all.filter((p) => !isR2(p));
  // R2 deletes are free; one request each, a few at a time.
  for (let i = 0; i < inR2.length; i += 10) await Promise.all(inR2.slice(i, i + 10).map((p) => r2().aws.fetch(objectUrl(keyOf(p)), { method: "DELETE" }).catch(() => null)));
  for (let i = 0; i < inSupabase.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(inSupabase.slice(i, i + 100));
    if (error) return error.message;
  }
  return null;
}

/**
 * A signed link for viewing (or downloading, with `download` as the file name). R2 links are made locally and are
 * the same for a whole hour, so the browser's cache keeps working across page loads.
 */
export async function signedUrl(supabase: SupabaseClient, path: string | null | undefined, seconds = 600, download?: string): Promise<string | null> {
  if (!path) return null;
  if (isR2(path)) return signR2(keyOf(path), seconds, download);
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}

/** Signed links for many files at once: R2 ones locally, Supabase ones in a single request. */
export async function signedUrls(supabase: SupabaseClient, paths: (string | null | undefined)[], seconds = 600): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  const inSupabase = wanted.filter((p) => !isR2(p));
  await Promise.all(wanted.filter(isR2).map(async (p) => { out.set(p, await signR2(keyOf(p), seconds)); }));
  if (inSupabase.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(inSupabase, seconds);
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  }
  return out;
}

const HOUR = 3600;
const MAX_EXPIRY = 7 * 24 * HOUR;
async function signR2(key: string, seconds: number, download?: string): Promise<string> {
  const url = new URL(objectUrl(key));
  if (download) url.searchParams.set("response-content-disposition", `attachment; filename="${download.replace(/["\\\r\n]/g, "")}"`);
  // Signed as of the start of the hour and valid for the rest of it plus `seconds`: one stable link per hour.
  // (A link that must last close to R2's 7-day maximum, such as a chat preview, is signed as of now instead.)
  const now = Math.floor(Date.now() / 1000);
  const roundable = seconds + HOUR <= MAX_EXPIRY;
  const start = roundable ? now - (now % HOUR) : now;
  url.searchParams.set("X-Amz-Expires", String(roundable ? seconds + HOUR : Math.min(MAX_EXPIRY, seconds)));
  const datetime = new Date(start * 1000).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const signed = await r2().aws.sign(url.toString(), { method: "GET", aws: { signQuery: true, datetime } });
  return signed.url;
}

/** Where the browser sends a new upload: a signed PUT link (R2), or Supabase's signed upload link. */
export async function uploadTarget(supabase: SupabaseClient, path: string): Promise<{ path: string; url: string; kind: "r2" | "supabase"; token?: string }> {
  if (isR2(path)) {
    const url = new URL(objectUrl(keyOf(path)));
    url.searchParams.set("X-Amz-Expires", String(HOUR));
    const signed = await r2().aws.sign(url.toString(), { method: "PUT", aws: { signQuery: true } });
    return { path, url: signed.url, kind: "r2" };
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not start upload");
  return { path, url: data.signedUrl, kind: "supabase", token: data.token };
}

/** R2 objects under a prefix with their last-modified time (for sweeping abandoned uploads). */
export async function listR2(prefix: string): Promise<{ path: string; modified: number }[]> {
  if (!r2Enabled()) return [];
  const out: { path: string; modified: number }[] = [];
  let token: string | null = null;
  do {
    const url = new URL(r2().base);
    url.searchParams.set("list-type", "2"); url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const res = await r2().aws.fetch(url.toString());
    if (!res.ok) break;
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = m[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1]; const mod = m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1];
      if (key) out.push({ path: R2 + key.replace(/&amp;/g, "&"), modified: mod ? Date.parse(mod) : 0 });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? null) : null;
  } while (token);
  return out;
}

function mimeOf(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "pdf" ? "application/pdf" : "image/jpeg";
}
