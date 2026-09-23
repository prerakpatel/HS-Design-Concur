"use client";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * One main role, then "+N" for the rest. The +N reveals the others on hover or tap. Roles arrive most significant
 * first (Core Admin, Approver, function tags; Member only when nothing else applies).
 */
export function RoleChips({ roles, className }: { roles: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [main, ...rest] = roles;
  const chip = "inline-flex h-6 items-center rounded-full bg-subtle px-2 text-xs font-medium text-muted-foreground ring-1 ring-border";
  if (!main) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={chip}>{main}</span>
      {rest.length > 0 && (
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`${rest.length} more role${rest.length === 1 ? "" : "s"}: ${rest.join(", ")}`} className={cn(chip, "cursor-default hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>+{rest.length}</button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{rest.join(" · ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
