"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/material-icon";

export interface Choice { value: string; label: string; hint?: string }

/**
 * Pill choices for short option sets (orgs, tags, role). Single or multi select.
 * Submits as hidden inputs under `name`, so it works inside plain <form action={serverAction}>.
 */
export function ChoiceChips({ name, options, defaultValue, multiple, size = "md", className, onChange }: {
  name: string; options: Choice[]; defaultValue?: string | string[]; multiple?: boolean; size?: "sm" | "md"; className?: string; onChange?: (values: string[]) => void;
}) {
  const initial = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  const [values, setValues] = useState<string[]>(initial);
  const toggle = (v: string) => {
    const next = multiple ? (values.includes(v) ? values.filter((x) => x !== v) : [...values, v]) : [v];
    setValues(next); onChange?.(next);
  };
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role={multiple ? "group" : "radiogroup"}>
      {values.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button key={o.value} type="button" role={multiple ? "checkbox" : "radio"} aria-checked={on} onClick={() => toggle(o.value)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors", size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-4 text-[15px]",
              on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40")}>
            {on && <Icon name="check" className="!text-[18px]" />}{o.label}
          </button>
        );
      })}
    </div>
  );
}
