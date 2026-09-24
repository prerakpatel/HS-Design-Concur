import type { SupabaseClient } from "@supabase/supabase-js";
import { makeReference } from "@/lib/images";
import { BUCKET } from "@/lib/storage";
import { PURGE_AFTER_DAYS, DELETE_RESTORE_DAYS, DRAFT_SWEEP_DAYS, DRAFT_WARN_DAYS } from "@/config/limits";
import { DEVICE_REFRESH_DAY } from "@/config/devices";

export interface RetentionReport { archived: number; archivedEvents: { id: string; org_id: string; title: string; created_by: string }[]; deletedForGood: number; draftsWarned: number; draftsSwept: number; deviceReminders: number; filesRemoved: number; errors: string[] }

interface SideRow { id: string; side: string; optimised_path: string | null; preview_path: string | null; thumb_path: string | null; reference_path: string | null }
interface VersionRow { id: string; number: number; decision: string; purged_at: string | null; created_at: string; version_sides: SideRow[] }
interface SlotRow { id: string; state: string; is_primary: boolean; versions: VersionRow[] }

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
const daysAgoDate = (days: number, tz: string) => new Date(Date.now() - days * 86400_000).toLocaleDateString("en-CA", { timeZone: tz });

/**
 * Nightly retention (PRD §8), run with the service client:
 * 1. Events dated ≥ 7 days ago: keep one reference image for the primary format only, delete every other file, archive.
 * 2. Events deleted ≥ 7 days ago: delete all files and the rows (text goes too; the restore window is over).
 * 3. Drafts untouched for 23 days: warn the creator. Untouched for 30 days: delete.
 * 4. Every 1 November: remind Designers and Core Admins to refresh the phone presets.
 * Each step is independent; a failure is reported and the others still run.
 */
export async function runRetention(db: SupabaseClient, opts: { tz: string; today: string }): Promise<RetentionReport> {
  const r: RetentionReport = { archived: 0, archivedEvents: [], deletedForGood: 0, draftsWarned: 0, draftsSwept: 0, deviceReminders: 0, filesRemoved: 0, errors: [] };
  const step = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { r.errors.push(`${name}: ${(e as Error).message}`); } };

  await step("archive", async () => {
    const { data: events, error } = await db.from("events").select("id,org_id,title,created_by").is("deleted_at", null).is("purged_at", null).neq("status", "draft").lte("event_date", daysAgoDate(PURGE_AFTER_DAYS, opts.tz));
    if (error) throw new Error(error.message);
    for (const ev of events ?? []) {
      const removed = await purgeEventFiles(db, ev.id, ev.org_id, true);
      const now = new Date().toISOString();
      await db.from("events").update({ status: "archived", archived_at: now, purged_at: now }).eq("id", ev.id);
      await db.from("activity").insert({ org_id: ev.org_id, event_id: ev.id, kind: "event.archived", payload: { title: ev.title, filesRemoved: removed } });
      r.archived++; r.filesRemoved += removed; r.archivedEvents.push(ev);
    }
  });

  await step("deleted", async () => {
    const { data: events, error } = await db.from("events").select("id,org_id").lte("deleted_at", daysAgoIso(DELETE_RESTORE_DAYS));
    if (error) throw new Error(error.message);
    for (const ev of events ?? []) {
      r.filesRemoved += await purgeEventFiles(db, ev.id, ev.org_id, false);
      const { error: delErr } = await db.from("events").delete().eq("id", ev.id);
      if (delErr) throw new Error(delErr.message);
      r.deletedForGood++;
    }
  });

  await step("drafts", async () => {
    const { data: stale, error } = await db.from("events").select("id,org_id,title,created_by,last_edited_at,draft_warned_at").eq("status", "draft").is("deleted_at", null).lte("last_edited_at", daysAgoIso(DRAFT_WARN_DAYS));
    if (error) throw new Error(error.message);
    const sweepBefore = daysAgoIso(DRAFT_SWEEP_DAYS);
    for (const ev of stale ?? []) {
      if (ev.last_edited_at <= sweepBefore) {
        r.filesRemoved += await purgeEventFiles(db, ev.id, ev.org_id, false);
        const { error: delErr } = await db.from("events").delete().eq("id", ev.id);
        if (delErr) throw new Error(delErr.message);
        await db.from("notifications").insert({ user_id: ev.created_by, kind: "draft.swept", payload: { title: ev.title } });
        r.draftsSwept++;
      } else if (!ev.draft_warned_at || ev.draft_warned_at < ev.last_edited_at) {
        await db.from("notifications").insert({ user_id: ev.created_by, kind: "draft.expiring", payload: { eventId: ev.id, title: ev.title, days: DRAFT_SWEEP_DAYS - DRAFT_WARN_DAYS } });
        await db.from("events").update({ draft_warned_at: new Date().toISOString() }).eq("id", ev.id);
        r.draftsWarned++;
      }
    }
  });

  await step("devices", async () => {
    const [year, month, day] = opts.today.split("-").map(Number);
    if (month !== DEVICE_REFRESH_DAY.month || day !== DEVICE_REFRESH_DAY.day) return;
    const { data: people, error } = await db.from("users").select("id").eq("status", "active").or("role.eq.core_admin,function_tags.cs.{designer}");
    if (error) throw new Error(error.message);
    for (const p of people ?? []) {
      const { data: dup } = await db.from("notifications").select("id").eq("user_id", p.id).eq("kind", "devices.refresh").contains("payload", { year }).limit(1);
      if (dup?.length) continue;
      await db.from("notifications").insert({ user_id: p.id, kind: "devices.refresh", payload: { year, href: "/settings?tab=formats" } });
      r.deviceReminders++;
    }
  });

  return r;
}

/**
 * Delete every stored file for an event. With `keepReferences`, the primary format (or, if none was marked,
 * the first approved format) keeps one small reference image per side (front, and back for print) from its
 * approved version, or its latest version if it was never approved. Nothing else survives.
 * Rows are kept and marked `purged_at`; path columns are cleared so the UI knows the files are gone.
 * Returns the number of objects removed.
 */
export async function purgeEventFiles(db: SupabaseClient, eventId: string, orgId: string, keepReferences: boolean): Promise<number> {
  const { data: slots, error } = await db.from("slots").select("id,state,is_primary,versions(id,number,decision,purged_at,created_at,version_sides(id,side,optimised_path,preview_path,thumb_path,reference_path))").eq("event_id", eventId).returns<SlotRow[]>();
  if (error) throw new Error(error.message);
  const firstUpload = (s: SlotRow) => s.versions.map((v) => v.created_at).sort()[0] ?? "";
  const keepSlot = (slots ?? []).find((s) => s.is_primary && s.versions.length) ?? [...(slots ?? [])].filter((s) => s.state === "approved").sort((a, b) => firstUpload(a).localeCompare(firstUpload(b)))[0] ?? null;
  const remove: string[] = [];
  const now = new Date().toISOString();
  for (const slot of slots ?? []) {
    const versions = [...(slot.versions ?? [])].sort((a, b) => b.number - a.number);
    const keep = keepReferences && keepSlot?.id === slot.id ? (versions.find((v) => v.decision === "approved") ?? versions[0]) : undefined;
    for (const v of versions) {
      for (const s of v.version_sides ?? []) {
        let reference = keepReferences ? s.reference_path : null;
        if (keep && v.id === keep.id && s.optimised_path && !reference) {
          const { data: file } = await db.storage.from(BUCKET).download(s.optimised_path);
          if (file) {
            const ref = await makeReference(Buffer.from(await file.arrayBuffer()));
            const path = `${orgId}/${eventId}/${slot.id}/reference/${s.side}.${ref.ext}`;
            const { error: upErr } = await db.storage.from(BUCKET).upload(path, ref.buf, { contentType: ref.mime, upsert: true });
            if (upErr) throw new Error(`reference for slot ${slot.id}: ${upErr.message}`);
            reference = path;
          }
        }
        for (const p of [s.optimised_path, s.preview_path, s.thumb_path]) if (p) remove.push(p);
        if (!keepReferences && s.reference_path) remove.push(s.reference_path);
        await db.from("version_sides").update({ optimised_path: null, preview_path: null, thumb_path: null, reference_path: reference }).eq("id", s.id);
      }
      if (!v.purged_at) await db.from("versions").update({ purged_at: now }).eq("id", v.id);
    }
  }
  let removed = 0;
  for (let i = 0; i < remove.length; i += 100) {
    const chunk = remove.slice(i, i + 100);
    const { error: rmErr } = await db.storage.from(BUCKET).remove(chunk);
    if (rmErr) throw new Error(`storage remove: ${rmErr.message}`);
    removed += chunk.length;
  }
  return removed;
}
