import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "assets";

export async function signedUrl(supabase: SupabaseClient, path: string | null | undefined, seconds = 600, download?: string) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}

/** URL of an object in a public bucket (the `branding` bucket holds org logos). */
export function publicUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
