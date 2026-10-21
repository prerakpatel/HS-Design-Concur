/**
 * Assets that were requested but nothing has been uploaded to yet. Pure helpers (no network) for the daily reminder:
 * who is owed a nudge, and how the unassigned ones read in a channel post.
 */
export interface WaitingSlot { slotId: string; eventId: string; orgId: string; title: string; format: string; assignee: string | null; url: string }
export interface WaitingProject { eventId: string; title: string; count: number; url: string }

/** Items with an active assignee go to that person; everything else (no one, or someone who no longer has access) is unassigned. */
export function splitWaiting<T extends WaitingSlot>(slots: T[], activeIds: Set<string>): { byPerson: Map<string, T[]>; unassigned: T[] } {
  const byPerson = new Map<string, T[]>();
  const unassigned: T[] = [];
  for (const s of slots) {
    if (s.assignee && activeIds.has(s.assignee)) byPerson.set(s.assignee, [...(byPerson.get(s.assignee) ?? []), s]);
    else unassigned.push(s);
  }
  return { byPerson, unassigned };
}

/** One entry per project, the one with the most waiting assets first. */
export function waitingProjects(slots: WaitingSlot[], eventUrl: (s: WaitingSlot) => string): WaitingProject[] {
  const m = new Map<string, WaitingProject>();
  for (const s of slots) {
    const p = m.get(s.eventId);
    if (p) p.count += 1; else m.set(s.eventId, { eventId: s.eventId, title: s.title, count: 1, url: eventUrl(s) });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export function projectBullet(p: { title: string; count: number; url?: string | null }): string {
  const text = p.url ? `<${p.url}|${p.title.replace(/[<>|]/g, "")}>` : p.title;
  return `• ${text}: ${p.count} asset${p.count === 1 ? "" : "s"} waiting`;
}

/** The channel text. As its own post it has a heading; added to another reminder it sits under a divider line. */
export function waitingChatSection(projects: WaitingProject[], total: number, bundled: boolean): string {
  const more = total - projects.length;
  return [
    ...(bundled ? ["──────────"] : []),
    "📥 Waiting on assets",
    ...projects.map(projectBullet), ...(more > 0 ? [`• and ${more} more`] : []),
    "Nothing has been uploaded to these yet and no one is assigned. Please add them soon.",
  ].join("\n");
}
