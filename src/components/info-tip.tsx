"use client";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";

/**
 * The (i) that explains a label. Opens on hover like any tooltip, and also on tap or click so it works on touch
 * screens and for people who do not hover. Use it next to a label, never as the only way to learn something vital.
 */
export function InfoTip({ text, label = "More information", className }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} onClick={() => setOpen((v) => !v)} className={cn("inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
          <Icon name="info" size={20} className="!text-[16px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-center">{text}</TooltipContent>
    </Tooltip>
  );
}
