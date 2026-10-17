"use client";
// icons: mic
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { ASSISTANT_HELLO_VERSION } from "@/config/assistant";
import type { CommentDraft, ProjectDraft } from "@/lib/assistant/schema";
import { CommentCard, ProjectCard, Say } from "@/components/assistant/cards";

/**
 * His first-time walk-through: two practice turns and a send-off. The person reads a sample line (or says it their
 * own way), hears themselves transcribed for real, and sees the card the sample would make. The brain is not called,
 * so trying him out costs nothing; the cards are canned and say so. Done or skipped, it stays away until he learns
 * something new (ASSISTANT_HELLO_VERSION).
 */
export type TourStep = 1 | 2 | 3;
export interface TourState { step: TourStep; said: string | null }

const TOUR_KEY = "dc.vichar.tour";
/** While he is being tested: the hello card and the walk-through come back on every load on this device (Settings → Vichar). */
export const STICKY_KEY = "dc.vichar.sticky";
export const vicharSticky = () => { try { return localStorage.getItem(STICKY_KEY) === "1"; } catch { return false; } };
export const tourDone = () => { if (vicharSticky()) return false; try { return localStorage.getItem(TOUR_KEY) === ASSISTANT_HELLO_VERSION; } catch { return true; } };
export const markTourDone = () => { try { localStorage.setItem(TOUR_KEY, ASSISTANT_HELLO_VERSION); } catch { /* private mode */ } };

const SAMPLES: Record<1 | 2, string> = {
  1: "New project for Sharad Purnima on 8 November with a print card 8.5 by 5.5, WhatsApp and Instagram.",
  2: "Tell the designer the text is cut off at the sides and to check the spelling of mahaprasad.",
};

/** The card the first sample makes, using this organization's real formats where their names fit. */
function practiceProject(formats: { key: string; name: string }[]): ProjectDraft {
  const pick = (re: RegExp, i: number) => formats.find((f) => re.test(f.name))?.key ?? formats[i]?.key ?? "print";
  const print = pick(/print|card/i, 0), wa = pick(/whatsapp/i, 1), ig = pick(/instagram/i, 2);
  return { title: "Sharad Purnima 2026", eventDate: "2026-11-08", venueName: null, description: null, notes: null, formats: [{ formatKey: print, label: null, size: { w: 8.5, h: 5.5 }, notes: null }, { formatKey: wa, label: null, size: null, notes: null }, { formatKey: ig, label: null, size: null, notes: null }], primaryFormatKey: print, gaps: ["Venue: say it, or set it on the review step."] };
}
const practiceComment: CommentDraft = { eventId: "practice", eventTitle: "Sharad Purnima", slotId: "practice", slotName: "Print card", change: true, mentionUserIds: [], unresolved: [], items: ["The text is cut off at the sides.", "Check the spelling of mahaprasad."] };

export function Tour({ tour, formats, formatNames, busy, onSay, onType, onNext, onSkip, onFinish }: {
  tour: TourState; formats: { key: string; name: string }[]; formatNames: Map<string, string>;
  /** He is listening or working out the words: the Say button waits. */
  busy: boolean;
  onSay: () => void; onType: () => void; onNext: () => void; onSkip: () => void; onFinish: () => void;
}) {
  if (tour.step === 3) return (
    <div className="space-y-4">
      <Say>That’s it. Say it your way, Gujarati or English, and tap when it looks right. Nothing is made until you tap.</Say>
      <Button onClick={onFinish} className="h-12 w-full rounded-full bg-brand text-[15px] text-brand-foreground hover:bg-brand-hover"><Icon name="mic" fill className="!text-[20px]" />Now for real</Button>
      <p className="text-center"><button type="button" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline" onClick={onSkip}>Later</button></p>
    </div>
  );
  const sample = SAMPLES[tour.step];
  return (
    <div className="space-y-3">
      <Say>{tour.step === 1 ? "Let’s try one. Say this, or in your own words:" : "Now a note for a designer. Say this, or your own way:"}</Say>
      <div className="rounded-2xl bg-subtle p-4 text-[15px] leading-6">“{sample}”</div>
      {tour.said == null ? (
        <>
          <Button onClick={onSay} disabled={busy} className="h-12 w-full rounded-full bg-brand text-[15px] text-brand-foreground hover:bg-brand-hover"><Icon name="mic" fill className="!text-[20px]" />{busy ? "Listening…" : "Say it"}</Button>
          <p className="flex justify-center gap-4 text-[13px] text-muted-foreground"><button type="button" className="underline-offset-4 hover:underline" onClick={onType}>Type it instead</button><button type="button" className="underline-offset-4 hover:underline" onClick={onSkip}>Skip</button></p>
        </>
      ) : (
        <>
          <div className="flex flex-col items-end"><span className="mb-0.5 text-[11px] text-muted-foreground">You said</span><div className="max-w-[90%] rounded-2xl rounded-br-md bg-brand-soft px-4 py-2.5 text-[15px] leading-6 text-brand-soft-foreground">{tour.said}</div></div>
          <Say>{tour.step === 1 ? "Here’s the draft that sentence makes." : "Here’s the change request it makes, one point per line."}</Say>
          {tour.step === 1 ? <ProjectCard p={practiceProject(formats)} formatNames={formatNames} /> : <CommentCard c={practiceComment} people={[]} onChange={() => {}} />}
          <p className="text-[13px] leading-[18px] text-muted-foreground">Practice: this is what the sample makes, whatever you said. For your own words, finish the walk-through.</p>
          <Button onClick={onNext} className="h-12 w-full rounded-full bg-brand text-[15px] text-brand-foreground hover:bg-brand-hover">Looks right</Button>
          <p className="text-center"><button type="button" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline" onClick={onSkip}>Skip the rest</button></p>
        </>
      )}
    </div>
  );
}
