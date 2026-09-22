"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

/** Date input that shows the day of the week next to it as you pick. */
export function DateField({ id, name, defaultValue, required }: { id?: string; name: string; defaultValue?: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const day = value ? format(new Date(value + "T00:00:00"), "EEEE") : null;
  return (
    <div className="flex items-center gap-3">
      <Input id={id} name={name} type="date" required={required} value={value} onChange={(e) => setValue(e.target.value)} className="max-w-[220px]" />
      <span className={"text-sm " + (day ? "font-medium" : "text-muted-foreground")}>{day ?? "Day shows here"}</span>
    </div>
  );
}
