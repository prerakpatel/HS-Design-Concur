/**
 * A small time-boxed memory for values every request would otherwise fetch again (the maintenance flag, the list of
 * organizations). It lives in the server instance, so on the free Supabase plan, where every request queues behind
 * the others, a click makes fewer trips. `forget` drops a value at once after the app itself changes it.
 */
const store = new Map<string, { at: number; value: unknown; pending?: Promise<unknown> }>();

export async function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return (hit.pending ?? hit.value) as T | Promise<T>;
  const pending = load();
  store.set(key, { at: Date.now(), value: undefined, pending });
  try {
    const value = await pending;
    store.set(key, { at: Date.now(), value });
    return value;
  } catch (e) { store.delete(key); throw e; }
}

export function forget(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
