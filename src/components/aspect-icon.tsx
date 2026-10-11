import { cn } from "@/lib/utils";
import { ratioFromSize } from "@/lib/aspect";

/**
 * A small outlined rectangle drawn at a format's proportions: tall for a story, wide for a banner, dashed when the
 * size is free. Give it either `ratio` (width ÷ height) or the `size` label.
 */
export function AspectIcon({ ratio, size, box = 18, className }: { ratio?: number | null; size?: string | null; box?: number; className?: string }) {
  const r = ratio !== undefined ? ratio : ratioFromSize(size);
  let w = box, h = box * 0.78;
  if (r) { if (r >= 1) { w = box; h = Math.max(5, box / r); } else { h = box; w = Math.max(5, box * r); } }
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center text-muted-foreground", className)} style={{ width: box, height: box }}>
      <span className={cn("block rounded-[3px] border-[1.5px] border-current", !r && "border-dashed")} style={{ width: Math.round(w), height: Math.round(h) }} />
    </span>
  );
}
