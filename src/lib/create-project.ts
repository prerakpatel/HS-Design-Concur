import type { ActiveContext } from "@/lib/auth";
import { UserError } from "@/lib/user-error";

/**
 * A new draft project with its brief and one (off) slot per catalogue format: what the wizard's first step does,
 * shared with the assistant. Returns the new event's id. Drafts do not count toward the organization's cap.
 */
export async function insertDraftProject({ supabase, user, org }: ActiveContext, f: { title: string; eventDate: string | null; venue_name: string | null; venue_address?: string | null; time_text?: string | null; description: string | null; notes: string | null }) {
  const { data, error } = await supabase.from("events").insert({ org_id: org.id, title: f.title, event_date: f.eventDate, venue: f.venue_name, created_by: user.id, status: "draft" }).select("id").single();
  if (error) throw new UserError(error.message);
  await supabase.from("briefs").insert({ event_id: data.id, description: f.description, time_text: f.time_text ?? null, venue_name: f.venue_name, venue_address: f.venue_address ?? null, notes: f.notes });
  const { data: formats } = await supabase.from("formats").select("id").eq("active", true);
  // Every catalog format gets a slot, all off; the Formats step turns on the ones this event needs.
  if (formats?.length) await supabase.from("slots").insert(formats.map((fm) => ({ event_id: data.id, format_id: fm.id, requested: false })));
  await supabase.from("activity").insert({ org_id: org.id, event_id: data.id, actor_id: user.id, kind: "event.created", payload: { title: f.title } });
  return data.id as string;
}

export interface FormatRequest { formatKey: string; label: string | null; size: { w: number; h: number } | null; notes: string | null }

/**
 * Turn formats on for a project (the wizard's Formats step, by format key): the project's off slot for that format
 * becomes requested with the size and notes given; a second request for the same format becomes a labelled slot.
 * Returns what was turned on and what was skipped (unknown keys, sizes on formats that have a fixed size).
 */
export async function requestFormats({ supabase }: ActiveContext, eventId: string, wanted: FormatRequest[], primaryKey: string | null) {
  const { data: formats } = await supabase.from("formats").select("id,key,name,allow_custom_size").eq("active", true);
  const byKey = new Map((formats ?? []).map((f) => [f.key as string, f as { id: string; key: string; name: string; allow_custom_size: boolean }]));
  const { data: slots } = await supabase.from("slots").select("id,format_id,requested,label").eq("event_id", eventId);
  const added: string[] = []; const skipped: string[] = [];
  const now = new Date().toISOString();
  for (const w of wanted) {
    const f = byKey.get(w.formatKey);
    if (!f) { skipped.push(w.formatKey); continue; }
    const size = w.size && f.allow_custom_size ? { custom_w: w.size.w, custom_h: w.size.h } : { custom_w: null, custom_h: null };
    const free = (slots ?? []).find((s) => s.format_id === f.id && !s.requested && !s.label);
    const sameLabel = w.label ? (slots ?? []).find((s) => s.format_id === f.id && s.label === w.label) : null;
    if (sameLabel) { skipped.push(`${f.name} (${w.label}) is already on the project`); continue; }
    if (free && !w.label) {
      const { error } = await supabase.from("slots").update({ requested: true, ...size, notes: w.notes, updated_at: now }).eq("id", free.id);
      if (error) throw new UserError(error.message);
      free.requested = true;
    } else if (w.label || !free) {
      const { error } = await supabase.from("slots").insert({ event_id: eventId, format_id: f.id, requested: true, label: w.label ?? null, notes: w.notes, ...size });
      if (error) { if (error.code === "23505") { skipped.push(`${f.name} is already on the project`); continue; } throw new UserError(error.message); }
    }
    added.push(w.label ? `${f.name} · ${w.label}` : f.name);
  }
  if (primaryKey && byKey.has(primaryKey)) {
    const fid = byKey.get(primaryKey)!.id;
    const { data: current } = await supabase.from("slots").select("id").eq("event_id", eventId).eq("is_primary", true);
    if (!current?.length) await supabase.from("slots").update({ is_primary: true }).eq("event_id", eventId).eq("format_id", fid).eq("requested", true).is("label", null);
  }
  await supabase.from("events").update({ last_edited_at: now }).eq("id", eventId);
  return { added, skipped };
}
