import { createClient } from "@supabase/supabase-js";

/** Service-role client for background jobs only (never in request handlers that act for a user). */
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * The service client when its key is set, else the given client. For looking up who to tell (approvers, chat links)
 * after a guest acts: a guest may not read the organization's people or settings, but the people still need telling.
 */
export function serviceOr<T>(fallback: T): ReturnType<typeof createServiceClient> | T {
  return process.env.SUPABASE_SECRET_KEY ? createServiceClient() : fallback;
}
