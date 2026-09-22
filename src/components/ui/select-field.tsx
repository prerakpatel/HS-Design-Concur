import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/material-icon";

/** Native <select> styled like Input, with the chevron sitting 16px from the edge instead of glued to it. */
export function SelectField({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative block", className)}>
      <select
        {...props}
        className="h-11 w-full appearance-none rounded-lg border border-input bg-card pl-3.5 pr-11 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </select>
      <Icon name="expand_more" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}
