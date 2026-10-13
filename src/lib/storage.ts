import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "assets";

export async function signedUrl(supabase: SupabaseClient, path: string | null | undefined, seconds = 600, download?: string) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}

/** Signed URLs for many objects in one request (one round trip instead of one per image). Missing paths are left out. */
export async function signedUrls(supabase: SupabaseClient, paths: (string | null | undefined)[], seconds = 600): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  if (!wanted.length) return new Map();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, seconds);
  const out = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/** URL of an object in a public bucket (the `branding` bucket holds org logos). */
export function publicUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
