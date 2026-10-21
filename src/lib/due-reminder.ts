/**
 * Assets due today or in a few days. Pure helpers (no network) for the daily reminder: the personal list (who owes
 * what) and the short channel post (which projects, never whose).
 */
import type { WaitingSlot } from "@/lib/assets-waiting";

export interface DueSlot extends WaitingSlot { due: string; when: "today" | "3d" }
export interface DueProject { eventId: string; title: string; url: string; today: number; soon: number }

/** One entry per project, the ones with something due today first. */
export function dueProjects(slots: DueSlot[], eventUrl: (s: DueSlot) => string): DueProject[] {
  const m = new Map<string, DueProject>();
  for (const s of slots) {
    const p = m.get(s.eventId) ?? { eventId: s.eventId, title: s.title, url: eventUrl(s), today: 0, soon: 0 };
    if (s.when === "today") p.today += 1; else p.soon += 1;
    m.set(s.eventId, p);
  }
  return [...m.values()].sort((a, b) => b.today - a.today || b.soon - a.soon || a.title.localeCompare(b.title));
}

export function dueBullet(p: { title: string; url?: string | null; today: number; soon: number }, soonLabel: string): string {
  const text = p.url ? `<${p.url}|${p.title.replace(/[<>|]/g, "")}>` : p.title;
  const parts = [p.today ? `${p.today} due today` : "", p.soon ? `${p.soon} due ${soonLabel}` : ""].filter(Boolean).join(", ");
  return `• ${text}: ${parts}`;
}

/** The channel text: a heading and one line per project. No names, no paragraph. */
export function dueChatBody(projects: DueProject[], total: number, soonLabel: string): string {
  const more = total - projects.length;
  return [...projects.map((p) => dueBullet(p, soonLabel)), ...(more > 0 ? [`• and ${more} more`] : [])].join("\n");
}
