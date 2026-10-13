import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { r2Enabled, writeFile, readFile, copyFile, removeFiles, signedUrl, R2 } from "@/lib/files";

/**
 * Checks the Cloudflare R2 connection end to end: write, read, copy, a signed link that really opens, delete.
 * Leaves nothing behind and returns only pass/fail. Open to Core Admins; on test links (Vercel previews) to anyone,
 * so it can be checked before going live.
 */
export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    const ctx = await getActiveUser();
    if (ctx?.user.role !== "core_admin") return NextResponse.json({ error: "Core Admins only" }, { status: 403 });
  }
  if (!r2Enabled()) return NextResponse.json({ r2: false, note: "R2_* environment variables are not all set" });
  const id = crypto.randomUUID();
  const a = `${R2}tmp/storage-check/${id}.txt`, b = `${R2}tmp/storage-check/${id}-copy.txt`;
  const steps: Record<string, string> = {};
  const step = async (name: string, f: () => Promise<unknown>) => { try { const r = await f(); steps[name] = r === false ? "failed" : "ok"; } catch (e) { steps[name] = `failed: ${(e as Error).message}`; } };
  const none = null as never;
  await step("write", () => writeFile(none, a, Buffer.from("hello"), "text/plain"));
  await step("read", async () => (await readFile(none, a))?.toString() === "hello");
  await step("copy", () => copyFile(none, a, b));
  await step("signed link", async () => { const url = await signedUrl(none, b); return url ? (await fetch(url)).ok : false; });
  await step("delete", async () => { await removeFiles(none, [a, b]); return (await readFile(none, a)) === null; });
  const ok = Object.values(steps).every((v) => v === "ok");
  return NextResponse.json({ r2: true, ok, steps }, { headers: { "Cache-Control": "no-store" } });
}
