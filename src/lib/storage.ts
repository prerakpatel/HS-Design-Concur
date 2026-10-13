// Asset files: see files.ts (Cloudflare R2 for new uploads, Supabase Storage for older ones).
export { BUCKET, signedUrl, signedUrls } from "@/lib/files";

/** URL of an object in a public bucket (the `branding` bucket holds org logos). */
export function publicUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
