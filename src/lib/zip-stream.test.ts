import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { zipStream, uniqueName, orderedPrefetch, type ZipEntry } from "./zip-stream.ts";

async function collect(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0; for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
const feed = (entries: ZipEntry[]) => { let i = 0; return async () => entries[i++] ?? null; };

test("a ZIP made as it is read opens and holds every file unchanged, in order", async () => {
  const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
  const zip = await collect(zipStream(feed([
    { name: "a.png", data: new Uint8Array([1, 2, 3]) },
    { name: "big.jpg", data: big },
    { name: "README.txt", data: new TextEncoder().encode("hello") },
  ])));
  const files = unzipSync(zip);
  assert.deepEqual(Object.keys(files), ["a.png", "big.jpg", "README.txt"]);
  assert.deepEqual([...files["a.png"]], [1, 2, 3]);
  assert.equal(files["big.jpg"].length, big.length);
  assert.ok(files["big.jpg"].every((v, i) => v === big[i]));
  assert.equal(strFromU8(files["README.txt"]), "hello");
});

test("two files with the same name both survive", async () => {
  const files = unzipSync(await collect(zipStream(feed([
    { name: "2026_event_flyer_v1.jpg", data: new Uint8Array([1]) },
    { name: "2026_event_flyer_v1.jpg", data: new Uint8Array([2]) },
    { name: "2026_event_flyer_v1.jpg", data: new Uint8Array([3]) },
  ]))));
  assert.deepEqual(Object.keys(files).sort(), ["2026_event_flyer_v1 (2).jpg", "2026_event_flyer_v1 (3).jpg", "2026_event_flyer_v1.jpg"]);
  assert.deepEqual([...files["2026_event_flyer_v1 (3).jpg"]], [3]);
});

test("files are only read as the reader asks for more", async () => {
  let produced = 0;
  const stream = zipStream(async () => (produced < 50 ? { name: `f${produced++}.bin`, data: new Uint8Array(1000) } : null));
  const reader = stream.getReader();
  await reader.read();
  assert.ok(produced <= 2, `read ${produced} files for the first chunk`);
  await reader.cancel();
});

test("a failure while reading a file fails the download instead of sending a broken ZIP as complete", async () => {
  let n = 0;
  const stream = zipStream(async () => { if (n++ === 1) throw new Error("storage went away"); return n === 1 ? { name: "a.png", data: new Uint8Array([1]) } : null; });
  await assert.rejects(collect(stream), /storage went away/);
});

test("uniqueName handles names without an extension", () => {
  const used = new Set<string>();
  assert.equal(uniqueName("README", used), "README");
  assert.equal(uniqueName("README", used), "README (2)");
});

test("prefetch keeps at most a few fetches in flight and returns results in order", async () => {
  let inFlight = 0; let peak = 0;
  const items = Array.from({ length: 20 }, (_, i) => i);
  const take = orderedPrefetch(items, async (n) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, n % 3 === 0 ? 15 : 1)); // later ones can finish first
    inFlight--; return `file${n}`;
  }, 4);
  const seen: string[] = [];
  for (let got = await take(); got; got = await take()) seen.push(got.value!);
  assert.deepEqual(seen, items.map((n) => `file${n}`));
  assert.ok(peak <= 4, `peak in flight was ${peak}`);
  assert.equal(await take(), null);
});

test("prefetch turns a failed fetch into a missing file, not an error", async () => {
  const take = orderedPrefetch(["a", "b", "c"], async (x) => { if (x === "b") throw new Error("boom"); return x.toUpperCase(); }, 2);
  assert.deepEqual(await take(), { item: "a", value: "A" });
  assert.deepEqual(await take(), { item: "b", value: null });
  assert.deepEqual(await take(), { item: "c", value: "C" });
  assert.equal(await take(), null);
});
