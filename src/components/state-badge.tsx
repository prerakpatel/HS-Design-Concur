import { cn } from "@/lib/utils";
import { Icon } from "@/components/material-icon";
import { SLOT_STATE_LABEL } from "@/lib/types";

export type BadgeState = keyof typeof SLOT_STATE_LABEL;

const STYLES: Record<BadgeState, string> = {
  requested: "bg-muted text-sidebar-foreground",
  in_review: "bg-info-soft text-info-text",
  changes_requested: "bg-destructive-soft text-destructive-text",
  approved: "bg-success-soft text-success-text",
  na: "border border-dashed border-border text-muted-foreground",
  draft: "bg-warning-soft text-warning-text",
  needs_you: "bg-brand-soft text-brand-foreground",
};

export function StateBadge({ state, label, className }: { state: BadgeState; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap", STYLES[state], className)}>
      {state === "approved" && <Icon name="check" className="!text-[14px]" />}
      {label ?? SLOT_STATE_LABEL[state]}
    </span>
  );
}
