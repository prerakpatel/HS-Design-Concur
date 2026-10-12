"use client";
import { useState } from "react";
import { format } from "date-fns";
import type { BriefView } from "@/components/events/event-detail";

const dt = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

/**
 * The body of an event's brief. Collapsed it is only the top row: on phones just "When" (the date and the first
 * timing line), on wider screens "When" and "Where" side by side. Everything else (all timings, the address,
 * the invite text, notes) opens with "See all details".
 */
export function EventBriefBody({ brief }: { brief: BriefView }) {
  const [open, setOpen] = useState(false);
  const date = brief.date ? format(new Date(brief.date + "T00:00:00"), "EEEE, d MMMM yyyy") : null;
  const timeLines = (brief.timeText ?? "").split("\n").filter(Boolean);
  return (
    <div>
      <dl className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <dt className={dt}>When</dt>
          <dd className="mt-1 text-sm font-medium">{date ?? <span className="font-normal text-muted-foreground">Date not set</span>}</dd>
          {timeLines.length > 0 && <dd className="whitespace-pre-line text-sm">{open ? timeLines.join("\n") : timeLines[0]}</dd>}
        </div>
        {/* Phones: Where waits for "See all details". */}
        <div className={open ? "" : "max-md:hidden"}>
          <dt className={dt}>Where</dt>
          <dd className="mt-1 text-sm font-medium">{brief.venueName ?? <span className="font-normal text-muted-foreground">Venue not set</span>}</dd>
          {open && brief.venueAddress && <dd className="whitespace-pre-line text-sm text-muted-foreground">{brief.venueAddress}</dd>}
        </div>
      </dl>
      {open && (
        <div className="mt-5 space-y-4">
          <div><p className={dt}>Invite text</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{brief.inviteText ?? <span className="text-muted-foreground">Not written yet. Add the invite text before designs start.</span>}</p></div>
          {brief.notes && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">For designers:</span> {brief.notes}</p>}
        </div>
      )}
      {/* A missing invite text is the one thing worth flagging without opening. */}
      {!open && !brief.inviteText && <p className="mt-3 text-sm text-warning-text">Invite text not written yet.</p>}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-3 text-sm font-medium text-info">{open ? "Show less" : "See all details"}</button>
    </div>
  );
}
