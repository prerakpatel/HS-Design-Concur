import { cn } from "@/lib/utils";

/** Initials on a soft brand disc; the person's Google photo on top when we have one (a broken photo just shows the initials). */
export function UserAvatar({ initials, src, size = 32, className }: { initials: string; src?: string | null; size?: 24 | 28 | 32 | 36 | 40; className?: string }) {
  const text = size <= 28 ? "text-[10px]" : size <= 36 ? "text-xs" : "text-sm";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-medium text-brand-foreground", text, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
      {src && <img src={src} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />}
    </span>
  );
}
