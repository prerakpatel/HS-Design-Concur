import { Zip, ZipPassThrough } from "fflate";

export interface ZipEntry { name: string; data: Uint8Array }

/** A name not yet used in the ZIP: "a.jpg" taken becomes "a (2).jpg", then "a (3).jpg". */
export function uniqueName(name: string, used: Set<string>): string {
  let out = name;
  if (used.has(out)) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let n = 2;
    while (used.has((out = `${stem} (${n})${ext}`))) n++;
  }
  used.add(out);
  return out;
}

/**
 * A ZIP written as it is read: one file is added each time the reader wants more, so only the files being
 * handled sit in memory, however large the whole download is. Files are stored, not compressed (designs are
 * already compressed). `next` hands over the files in order and returns null at the end.
 */
export function zipStream(next: () => Promise<ZipEntry | null>): ReadableStream<Uint8Array> {
  const queue: Uint8Array[] = [];
  let finished = false;
  let failure: unknown = null;
  const zip = new Zip((err, chunk, final) => {
    if (err) failure = err; else queue.push(chunk);
    if (final) finished = true;
  });
  const used = new Set<string>();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (queue.length === 0 && !finished && !failure) {
          const entry = await next();
          if (!entry) { zip.end(); continue; }
          const file = new ZipPassThrough(uniqueName(entry.name, used));
          zip.add(file);
          file.push(entry.data, true);
        }
      } catch (e) { failure = e; }
      if (failure) { controller.error(failure); return; }
      const chunk = queue.shift();
      if (chunk) controller.enqueue(chunk);
      if (queue.length === 0 && finished) controller.close();
    },
  });
}

/**
 * Fetch items with a few requests in flight at once but hand the results back strictly in order, releasing each as
 * it is taken. A fetch that fails comes back as null (the caller notes it as missing) and never as an exception.
 */
export function orderedPrefetch<T, R>(items: T[], fetchOne: (item: T) => Promise<R | null>, ahead: number): () => Promise<{ item: T; value: R | null } | null> {
  const pending = new Map<number, Promise<R | null>>();
  let launched = 0; let taken = 0;
  const launch = () => { if (launched < items.length) { const i = launched++; pending.set(i, fetchOne(items[i]).catch(() => null)); } };
  for (let i = 0; i < ahead; i++) launch();
  return async () => {
    if (taken >= items.length) return null;
    const i = taken++;
    const value = await pending.get(i)!;
    pending.delete(i);
    launch();
    return { item: items[i], value };
  };
}
