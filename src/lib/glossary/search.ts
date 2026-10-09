import { termKey, soundKey, distance } from "./sound.ts";

export interface GlossaryEntry { id: string; term: string; definition: string | null; variants: string[] }
export interface Indexed { entry: GlossaryEntry; forms: { label: string; isTerm: boolean; tk: string; sk: string }[]; meaning: string }
export type Via = "exact" | "variant" | "sound" | "starts" | "close" | "meaning";
export interface Hit { entry: GlossaryEntry; score: number; via: Via; matched: string }

export function indexEntries(entries: GlossaryEntry[]): Indexed[] {
  return entries.map((entry) => ({
    entry,
    forms: [{ label: entry.term, isTerm: true }, ...entry.variants.map((v) => ({ label: v, isTerm: false }))].map((f) => ({ ...f, tk: termKey(f.label), sk: soundKey(f.label) })),
    meaning: (entry.definition ?? "").toLowerCase(),
  }));
}

/**
 * Find the approved spelling for whatever someone typed. Ranked: the spelling exactly, then a variant, then words
 * that sound the same, then starts-with, then a near miss, then a word in the meaning ("ego" finds ahamkar).
 */
export function searchGlossary(query: string, index: Indexed[], limit = 40): Hit[] {
  const qk = termKey(query);
  if (!qk) return [];
  const qs = soundKey(query);
  const plain = query.trim().toLowerCase();
  const maxEdit = qs.length >= 7 ? 2 : 1;
  const hits: Hit[] = [];
  for (const { entry, forms, meaning } of index) {
    let best: Hit | null = null;
    const offer = (score: number, via: Via, matched: string) => { if (!best || score > best.score) best = { entry, score, via, matched }; };
    for (const f of forms) {
      if (f.tk === qk) offer(f.isTerm ? 100 : 95, f.isTerm ? "exact" : "variant", f.label);
      else if (f.sk === qs) offer(f.isTerm ? 85 : 80, "sound", f.label);
      else if (qk.length >= 2 && f.tk.startsWith(qk)) offer(70 - Math.min(10, f.tk.length - qk.length), "starts", f.label);
      else if (qs.length >= 3 && f.sk.startsWith(qs)) offer(65 - Math.min(10, f.sk.length - qs.length), "starts", f.label);
      else if (f.sk.length >= 4 && qs.startsWith(f.sk) && qs.length - f.sk.length <= 2) offer(60, "close", f.label);
      else if (qs.length >= 3 && distance(f.sk, qs, maxEdit) <= maxEdit) offer(50 - 5 * distance(f.sk, qs, maxEdit), "close", f.label);
    }
    if (!best && plain.length >= 3 && new RegExp(`\\b${plain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(meaning)) offer(20, "meaning", plain);
    if (best) hits.push(best);
  }
  hits.sort((a, b) => b.score - a.score || a.entry.term.localeCompare(b.entry.term));
  // With a confident match, near misses and meaning hits are noise.
  const confident = (hits[0]?.score ?? 0) >= 80;
  return hits.filter((h) => !confident || h.score >= 60).slice(0, limit);
}
