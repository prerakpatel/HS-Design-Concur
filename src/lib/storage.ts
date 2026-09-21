import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "assets";

export async function signedUrl(supabase: SupabaseClient, path: string | null | undefined, seconds = 600) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
