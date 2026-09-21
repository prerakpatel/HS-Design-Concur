import { cn } from "@/lib/utils";

/** Material Symbols Rounded ligature. `name` is the symbol name, e.g. "event". */
export function Icon({ name, size = 20, fill = false, className }: { name: string; size?: 20 | 24; fill?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("msr", className)} data-size={size} data-fill={fill ? "1" : "0"}>
      {name}
    </span>
  );
}
