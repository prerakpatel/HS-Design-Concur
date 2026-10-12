"use client";
import { useState, type ReactNode } from "react";

/**
 * The long part of a brief: two lines by default, the rest behind "See all details". A plain toggle rather than
 * <details>, because a closed <details> hides everything but its summary and the two-line preview must stay visible.
 */
export function BriefMore({ label, text, empty, notes, extra }: { label: string; text: string | null; empty: string; notes?: string | null; /** More rows shown only when open. */ extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dt = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <div>
      <p className={dt}>{label}</p>
      <p className={"mt-1 whitespace-pre-wrap text-sm leading-6 " + (open ? "" : "line-clamp-2")}>{text ?? <span className="text-muted-foreground">{empty}</span>}</p>
      {open && (notes || extra) && (
        <div className="mt-3 space-y-4">
          {notes && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">For designers:</span> {notes}</p>}
          {extra}
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 text-sm font-medium text-info">{open ? "Show less" : "See all details"}</button>
    </div>
  );
}
