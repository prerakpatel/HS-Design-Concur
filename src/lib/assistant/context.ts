import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveContext } from "@/lib/auth";
import { loadProjectPeople } from "@/lib/project-people";
import { slotName } from "@/lib/project";
import { todayIso } from "@/lib/time";
import type { Where } from "@/lib/assistant/schema";

/**
 * Everything the assistant is allowed to know, as compact text: the format catalogue, this organization's projects
 * (with their formats, sizes and designs), the people it may @mention, and the glossary. Read with the person's own
 * client, so row-level security decides what is in it. Ids are shortened to their first 8 characters to keep the
 * prompt small; `resolve` turns them back into real ids, and anything unknown is dropped.
 */
export interface AssistantContext {
  text: string;
  /** Short id → real id, for events, slots and people the person may see. */
  ids: Map<string, string>;
  /** People the assistant may mention (the organization, plus the current project's guests). */
  people: { id: string; name: string }[];
  formatKeys: Set<string>;
}

const short = (id: string) => id.slice(0, 8);

export async function loadAssistantContext(ctx: ActiveContext, where: Where): Promise<AssistantContext> {
  const { supabase, org } = ctx;
  const ids = new Map<string, string>();
  const remember = (id: string) => { ids.set(short(id), id); return short(id); };
  const since = new Date(); since.setDate(since.getDate() - 420);

  const [{ data: formats }, { data: events }, { data: members }, { data: glossary }] = await Promise.all([
    supabase.from("formats").select("key,name,width,height,unit,class,allow_custom_size,notes").eq("active", true).order("sort"),
    supabase.from("events").select("id,title,event_date,status,kind,venue,slots(id,format_id,requested,custom_w,custom_h,label,state,is_primary,assignee_id,versions(id,number,sent_at,decision))").eq("org_id", org.id).is("deleted_at", null).gte("created_at", since.toISOString()).order("event_date", { ascending: false, nullsFirst: false }).limit(40),
    supabase.from("users").select("id,name,email,function_tags,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id),
    supabase.from("glossary_entries").select("term").order("term").limit(400),
  ]);
  const { data: formatRows } = await supabase.from("formats").select("id,key,name").eq("active", true);
  const formatById = new Map((formatRows ?? []).map((f) => [f.id as string, f as { id: string; key: string; name: string }]));

  const lines: string[] = [];
  lines.push(`Today: ${todayIso()}. Organization: ${org.name}.`);
  lines.push("", "FORMATS (key | name | size | notes):");
  for (const f of formats ?? []) {
    const size = f.allow_custom_size ? `custom size allowed (${f.unit})` : `${f.width} × ${f.height} ${f.unit}`;
    lines.push(`- ${f.key} | ${f.name} | ${f.class} | ${size}${f.notes ? ` | ${f.notes}` : ""}`);
  }

  lines.push("", "PROJECTS (id | title | date | status). Under each: slot id | format | size | state | latest design.");
  type Ver = { id: string; number: number; sent_at: string | null; decision: string };
  type SlotRow = { id: string; format_id: string; requested: boolean; custom_w: number | null; custom_h: number | null; label: string | null; state: string; is_primary: boolean; assignee_id: string | null; versions: Ver[] };
  type Ev = { id: string; title: string; event_date: string | null; status: string; kind: string | null; venue: string | null; slots: SlotRow[] };
  for (const e of (events ?? []) as unknown as Ev[]) {
    const mark = where.eventId === e.id ? " ← the person is looking at this project" : "";
    lines.push(`- ${remember(e.id)} | ${e.title} | ${e.event_date ?? "no date"} | ${e.status}${e.kind === "assets" ? " (assets request)" : ""}${mark}`);
    for (const s of e.slots.filter((x) => x.requested)) {
      const f = formatById.get(s.format_id);
      const latest = [...(s.versions ?? [])].sort((a, b) => b.number - a.number)[0];
      const design = latest ? `v${latest.number} ${latest.decision === "approved" ? "approved" : latest.sent_at ? "in review" : "not sent yet"}` : "nothing uploaded";
      const size = s.custom_w && s.custom_h ? `${s.custom_w} × ${s.custom_h}` : "default size";
      const here = where.slotId === s.id ? " ← the person is looking at this design" : "";
      lines.push(`    ${remember(s.id)} | ${slotName(f?.name, s.label)} (${f?.key ?? "?"}) | ${size} | ${s.state}${s.is_primary ? ", primary" : ""} | ${design}${here}`);
    }
  }

  const people: { id: string; name: string }[] = ((members ?? []) as { id: string; name: string | null; email: string }[]).map((m) => ({ id: m.id, name: m.name ?? m.email.split("@")[0] }));
  if (where.eventId) {
    try {
      const guests = (await loadProjectPeople(supabase as SupabaseClient, { id: where.eventId })).filter((p) => p.guest && p.userId);
      for (const g of guests) if (!people.some((p) => p.id === g.userId)) people.push({ id: g.userId!, name: g.name });
    } catch { /* not a project the person can see */ }
  }
  lines.push("", "PEOPLE (id | name). Match names loosely: 'Chirantanbhai' is Chirantan; '-bhai' and '-ben' are respectful suffixes, not part of the name.");
  const memberTags = new Map(((members ?? []) as { id: string; function_tags: string[] }[]).map((m) => [m.id, m.function_tags]));
  for (const p of people) lines.push(`- ${remember(p.id)} | ${p.name}${(memberTags.get(p.id) ?? []).length ? ` (${memberTags.get(p.id)!.join(", ")})` : ""}`);

  if (glossary?.length) lines.push("", "GLOSSARY (spell these words this way): " + glossary.map((g) => g.term as string).join(", "));

  return { text: lines.join("\n"), ids, people, formatKeys: new Set((formats ?? []).map((f) => f.key as string)) };
}

/** Real id for a short id the assistant used; null when it made one up. Full ids pass through. */
export function resolveId(c: AssistantContext, id: string | null | undefined): string | null {
  if (!id) return null;
  if (c.ids.has(id)) return c.ids.get(id)!;
  for (const real of c.ids.values()) if (real === id) return real;
  return null;
}
