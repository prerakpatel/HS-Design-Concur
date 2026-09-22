import { cn } from "@/lib/utils";
import { publicUrl } from "@/lib/storage";

/** An organisation's logo, or a brand-coloured initial until one is uploaded (Settings → Organisations). */
export function OrgMark({ org, size = 32, className }: { org: { short_name: string; logo_path?: string | null }; size?: 24 | 32 | 40 | 48 | 64; className?: string }) {
  const url = publicUrl("branding", org.logo_path);
  const radius = size >= 48 ? "rounded-2xl" : size >= 32 ? "rounded-lg" : "rounded-md";
  if (url) {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden bg-card ring-1 ring-border", radius, className)} style={{ width: size, height: size }}>
        <img src={url} alt={org.short_name} className="size-full object-contain p-0.5" />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center bg-brand font-medium text-brand-foreground", radius, className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {org.short_name[0]}
    </span>
  );
}
