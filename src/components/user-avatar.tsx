import { cn } from "@/lib/utils";

export function UserAvatar({ initials, size = 32, className }: { initials: string; size?: 24 | 28 | 32 | 40; className?: string }) {
  const text = size <= 28 ? "text-[10px]" : size === 32 ? "text-xs" : "text-sm";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-medium text-brand-foreground", text, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
