import { APP_TIMEZONE } from "@/config/orgs";
import { REMINDER_LEAD_DAYS, REVIEW_WAIT_HOURS, UNSENT_NUDGE_HOURS } from "@/config/limits";
import { todayIso, daysFromNowIso, DAY_MS, HOUR_MS } from "@/lib/time";
import { NextResponse } from "next/server";
import { slotName } from "@/lib/project";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, appUrl, emailConfigured } from "@/lib/email";
import { notificationText, notificationHref } from "@/lib/labels";
import { notify, subjectFor, approverIds, type NotificationKind } from "@/lib/notify";
import { runRetention } from "@/lib/retention";
import { refreshStalePreviews } from "@/lib/uploads/refresh-preview";
import { pruneAllSlots, sweepTmpUploads } from "@/lib/uploads/prune";
import { matchSlackIds } from "@/lib/slack";
import { mentionIds, groupMentionIds } from "@/lib/rich-text";
import { postRelease } from "@/lib/changelog";
import { RELEASES } from "@/config/changelog";
import { getActiveUser } from "@/lib/auth";

export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, 13:00 UTC ≈ morning in New York). Runs, in order:
 * 1. Due-date reminders: slots due today or in 3 days → in-app, push and a chat @mention for the designer.
 *    Then designs waiting ≥ 1 day for a decision → the approvers, once a day until approved or changes requested.
 * 2. Retention (PRD §8): archive + purge a week after the event date, hard-delete after the restore window,
 *    draft warning / sweep, yearly device-preset reminder. See src/lib/retention.ts.
 * 3. Daily digest email for users whose email_pref is "digest", then instant emails for job-created kinds.
 * 4. Re-stamp up to 20 previews that still carry an older DRAFT mark.
 * Vercel Cron calls it with the CRON_SECRET bearer; a signed-in Core Admin may also open the URL to run it now.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const byCron = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const byAdmin = !byCron && (await getActiveUser().catch(() => null))?.user.role === "core_admin";
  if (!byCron && !byAdmin) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = createServiceClient();
  const tz = APP_TIMEZONE;
  const today = todayIso(tz);
  const in3 = daysFromNowIso(REMINDER_LEAD_DAYS, tz);
  const report: Record<string, unknown> = { reminders: 0, waiting: 0, digests: 0 };

  // 0. Assets-only requests ending in 3 days: tell the requester and the designers to download their finals.
  const { data: ending } = await db.from("events").select("id,org_id,title,created_by,slots(assignee_id)").eq("kind", "assets").eq("status", "active").is("deleted_at", null).eq("event_date", in3);
  for (const ev of ending ?? []) {
    const { data: dup } = await db.from("notifications").select("id").eq("kind", "project.ending").contains("payload", { eventId: ev.id }).limit(1);
    if (dup?.length) continue;
    const people = [ev.created_by, ...((ev.slots as { assignee_id: string | null }[] | null) ?? []).map((x) => x.assignee_id)];
    await notify(db, people, "project.ending", { eventId: ev.id, title: ev.title }, undefined, { orgId: ev.org_id });
  }

  // 1. Due-date reminders
  const { data: due } = await db.from("slots").select("id,due_on,assignee_id,event_id,label,formats(name),events(title,status,org_id)").eq("requested", true).neq("state", "approved").not("assignee_id", "is", null).in("due_on", [today, in3]);
  for (const s of due ?? []) {
    const ev = s.events as unknown as { title: string; status: string; org_id: string }; if (ev.status !== "active") continue;
    const payload = { eventId: s.event_id, slotId: s.id, title: ev.title, format: slotName((s.formats as unknown as { name: string }).name, s.label as string | null), when: s.due_on === today ? "today" : "3d", due: s.due_on, assignee: s.assignee_id };
    const { data: dup } = await db.from("notifications").select("id").eq("user_id", s.assignee_id).eq("kind", "slot.due").contains("payload", { slotId: s.id, when: payload.when }).limit(1);
    if (dup?.length) continue;
    await notify(db, [s.assignee_id], "slot.due", payload, undefined, { orgId: ev.org_id });
    report.reminders = (report.reminders as number) + 1;
  }

  // 1b. Designs waiting for review for a day or more: one reminder per organization per day to its approvers (one
  // chat post, one push, one in-app item), listing every design, until each is decided.
  const { data: waiting } = await db.from("versions").select("id,number,sent_at,uploaded_by,slots!inner(id,event_id,state,label,formats(name),events(title,status,org_id)),uploader:uploaded_by(name,email)").eq("decision", "pending").not("sent_at", "is", null).lte("sent_at", new Date(Date.now() - REVIEW_WAIT_HOURS * HOUR_MS).toISOString()).eq("slots.state", "in_review");
  type Waiting = { eventId: string; slotId: string; versionId: string; title: string; format: string; number: number; days: number; by: string | undefined; since: string; uploadedBy: string };
  const waitingByOrg = new Map<string, Waiting[]>();
  for (const v of waiting ?? []) {
    const slot = v.slots as unknown as { id: string; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string; org_id: string } };
    if (slot.events.status !== "active") continue;
    const up = v.uploader as unknown as { name: string | null; email: string } | null;
    const row: Waiting = { eventId: slot.event_id, slotId: slot.id, versionId: v.id, title: slot.events.title, format: slotName(slot.formats.name, slot.label), number: v.number, days: Math.floor((Date.now() - new Date(v.sent_at).getTime()) / DAY_MS), by: up?.name ?? up?.email, since: v.sent_at, uploadedBy: v.uploaded_by };
    waitingByOrg.set(slot.events.org_id, [...(waitingByOrg.get(slot.events.org_id) ?? []), row]);
  }
  for (const [orgId, rows] of waitingByOrg) {
    const approvers = await approverIds(db, orgId);
    if (approvers.length === 0) continue;
    rows.sort((a, b) => b.days - a.days);
    if (rows.length === 1) {
      const r = rows[0];
      const { data: dup } = await db.from("notifications").select("id").eq("kind", "review.waiting").contains("payload", { versionId: r.versionId, day: today }).limit(1);
      if (dup?.length) continue;
      await notify(db, approvers, "review.waiting", { eventId: r.eventId, slotId: r.slotId, versionId: r.versionId, title: r.title, format: r.format, number: r.number, by: r.by, since: r.since, days: r.days, day: today }, r.uploadedBy, { orgId });
    } else {
      const { data: dup } = await db.from("notifications").select("id").eq("kind", "reviews.waiting").contains("payload", { orgId, day: today }).limit(1);
      if (dup?.length) continue;
      const items = rows.slice(0, 15).map((r) => ({ title: r.title, format: r.format, number: r.number, days: r.days }));
      await notify(db, approvers, "reviews.waiting", { orgId, day: today, count: rows.length, items, title: items.slice(0, 3).map((i) => `${i.title} · ${i.format}`).join(" · ") + (rows.length > 3 ? ` · +${rows.length - 3} more` : "") }, undefined, { orgId });
    }
    report.waiting = ((report.waiting as number) ?? 0) + rows.length;
  }

  // 1c. Review-mode comments nobody sent: nudge their author (in-app and push only, never chat), once a day.
  const { data: unsent } = await db.from("comments").select("author_id,version_id,versions!inner(number,slots!inner(id,event_id,label,formats(name),events(title,status,org_id)))").eq("is_draft", true).lte("created_at", new Date(Date.now() - UNSENT_NUDGE_HOURS * HOUR_MS).toISOString());
  const unsentBy = new Map<string, { author: string; row: NonNullable<typeof unsent>[number]; count: number }>();
  for (const c of unsent ?? []) { const k = `${c.author_id}:${c.version_id}`; const e = unsentBy.get(k); if (e) e.count++; else unsentBy.set(k, { author: c.author_id as string, row: c, count: 1 }); }
  report.unsent = 0;
  for (const [, u] of unsentBy) {
    const v = u.row.versions as unknown as { number: number; slots: { id: string; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string } } };
    if (v.slots.events.status !== "active") continue;
    const { data: dup } = await db.from("notifications").select("id").eq("user_id", u.author).eq("kind", "comments.unsent").contains("payload", { versionId: u.row.version_id, day: today }).limit(1);
    if (dup?.length) continue;
    await notify(db, [u.author], "comments.unsent", { eventId: v.slots.event_id, slotId: v.slots.id, versionId: u.row.version_id, title: v.slots.events.title, format: slotName(v.slots.formats.name, v.slots.label), number: v.number, count: u.count, day: today });
    report.unsent = (report.unsent as number) + 1;
  }

  // 1d. Comments that name a person (not a group) and are still open a day later: remind that person to mark them
  // done, so nothing sits open by mistake. One in-app / push / email reminder per person per day, plus one chat post
  // per organization listing who has comments waiting.
  type OpenComment = { id: string; author_id: string; body: string; mentions: string[] | null; versions: { number: number; slots: { id: string; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string; org_id: string; deleted_at: string | null } } } };
  const { data: openRaw } = await db.from("comments").select("id,author_id,body,mentions,versions!inner(number,slots!inner(id,event_id,label,formats(name),events!inner(title,status,org_id,deleted_at)))").eq("is_draft", false).is("addressed_at", null).is("confirmed_at", null).lte("created_at", new Date(Date.now() - REVIEW_WAIT_HOURS * HOUR_MS).toISOString()).limit(2000);
  const openComments = ((openRaw ?? []) as unknown as OpenComment[]).filter((c) => (c.mentions?.length ?? 0) > 0 && c.versions.slots.events.status === "active" && !c.versions.slots.events.deleted_at);
  const groupIds = [...new Set(openComments.flatMap((c) => groupMentionIds(c.body)))];
  const { data: gm } = groupIds.length ? await db.from("group_members").select("group_id,user_id").in("group_id", groupIds) : { data: [] as { group_id: string; user_id: string }[] };
  const groupMembers = new Map<string, string[]>();
  for (const m of gm ?? []) groupMembers.set(m.group_id, [...(groupMembers.get(m.group_id) ?? []), m.user_id]);
  const { data: activeUsers } = await db.from("users").select("id").eq("status", "active");
  const active = new Set((activeUsers ?? []).map((u) => u.id as string));
  // person → org → open comments they were named in (never because a group they are in was named)
  const owed = new Map<string, Map<string, OpenComment[]>>();
  for (const c of openComments) {
    const viaGroup = new Set(groupIds.length ? groupMentionIds(c.body).flatMap((g) => groupMembers.get(g) ?? []) : []);
    const named = new Set(mentionIds(c.body));
    for (const id of c.mentions ?? []) {
      if (id === c.author_id || !active.has(id)) continue;
      if (viaGroup.has(id) && !named.has(id)) continue;
      const orgs = owed.get(id) ?? new Map<string, OpenComment[]>();
      const org = c.versions.slots.events.org_id;
      orgs.set(org, [...(orgs.get(org) ?? []), c]); owed.set(id, orgs);
    }
  }
  report.openComments = 0;
  // Chat gets no names: one post per organization saying which assets still have open comments.
  const assetsByOrg = new Map<string, Map<string, { eventId: string; slotId: string; title: string; format: string; open: number }>>();
  const seenComment = new Set<string>();
  for (const [person, orgs] of owed) {
    const { data: dup } = await db.from("notifications").select("id").eq("user_id", person).eq("kind", "comments.pending").contains("payload", { day: today }).limit(1);
    if (dup?.length) continue;
    const all = [...orgs.values()].flat();
    const first = all[0].versions.slots;
    const places = [...new Map(all.map((c) => [c.versions.slots.id, `${c.versions.slots.events.title} · ${slotName(c.versions.slots.formats.name, c.versions.slots.label)}`])).values()];
    await notify(db, [person], "comments.pending", { count: all.length, day: today, href: `/events/${first.event_id}/slots/${first.id}`, title: places.slice(0, 3).join(" · ") + (places.length > 3 ? ` · +${places.length - 3} more` : ""), places: places.length });
    for (const [org, list] of orgs) for (const c of list) {
      if (seenComment.has(c.id)) continue; seenComment.add(c.id);
      const sl = c.versions.slots; const m = assetsByOrg.get(org) ?? new Map();
      m.set(sl.id, { eventId: sl.event_id, slotId: sl.id, title: sl.events.title, format: slotName(sl.formats.name, sl.label), open: (m.get(sl.id)?.open ?? 0) + 1 }); assetsByOrg.set(org, m);
    }
    report.openComments = (report.openComments as number) + all.length;
  }
  // The whole-channel ping goes out on alternate days; the post itself is daily.
  const pingToday = Math.floor(new Date(`${today}T00:00:00Z`).getTime() / DAY_MS) % 2 === 0;
  for (const [orgId, byAsset] of assetsByOrg) {
    const assets = [...byAsset.values()].sort((x, y) => y.open - x.open).slice(0, 15);
    await notify(db, [], "comments.pending", { assets, total: byAsset.size, day: today, orgId, pingAll: pingToday, ...(assets.length === 1 ? { eventId: assets[0].eventId, slotId: assets[0].slotId } : {}) }, undefined, { orgId, mention: [] });
  }

  // 2. Retention (+ tell the creator and the chat that an event was archived)
  const retention = await runRetention(db, { tz, today });
  for (const ev of retention.archivedEvents) await notify(db, [ev.created_by], "event.archived", { eventId: ev.id, title: ev.title, kind: ev.kind }, undefined, { orgId: ev.org_id });
  report.retention = { ...retention, archivedEvents: retention.archivedEvents.map((e) => e.title) };

  // 3. Daily digest
  if (emailConfigured()) {
    const { data: users } = await db.from("users").select("id,email,name").eq("status", "active").eq("email_pref", "digest");
    for (const u of users ?? []) {
      const { data: items } = await db.from("notifications").select("id,kind,payload").eq("user_id", u.id).is("emailed_at", null).order("created_at", { ascending: false }).limit(30);
      if (!items?.length) continue;
      const lines = items.map((n) => `• ${notificationText(n.kind, n.payload as Record<string, unknown>)}`).join("\n");
      const r = await sendEmail(u.email, `Design & Concur: ${items.length} update${items.length === 1 ? "" : "s"}`, { heading: "Your daily digest", body: lines, cta: { label: "Open Inbox", href: appUrl(items.length === 1 ? notificationHref(items[0].payload as Record<string, unknown>) : "/inbox") } });
      if ("ok" in r) { await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", items.map((n) => n.id)); report.digests = (report.digests as number) + 1; }
    }
    // Instant users also get job-created notifications by email (they bypass the request-time delivery path).
    const { data: instant } = await db.from("notifications").select("id,user_id,kind,payload,users!inner(email,email_pref,status)").in("kind", ["slot.due", "review.waiting", "reviews.waiting", "comments.pending", "draft.expiring", "draft.swept", "devices.refresh"]).is("emailed_at", null).eq("users.email_pref", "instant").eq("users.status", "active");
    for (const n of instant ?? []) {
      const u = n.users as unknown as { email: string }; const p = n.payload as Record<string, unknown>;
      const r = await sendEmail(u.email, subjectFor(n.kind as NotificationKind, p), { heading: notificationText(n.kind, p), body: String(p.title ?? ""), cta: { label: "Open Design & Concur", href: appUrl(notificationHref(p)) } });
      if ("ok" in r) await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
    }
  }
  // 3b. Release notes not yet announced in chat (a Core Admin may also share them from the dialog).
  const { data: sharedRows } = await db.from("changelog_posts").select("release_id");
  const shared = new Set((sharedRows ?? []).map((r) => r.release_id as string));
  report.releasesPosted = 0;
  // Announce only the newest release. Older ones nobody posted (the job was not running) are marked as shared, not
  // sent, so a catch-up never floods the channels.
  const unannounced = RELEASES.filter((x) => !shared.has(x.id));
  if (unannounced.length > 1) await db.from("changelog_posts").insert(unannounced.slice(1).map((r) => ({ release_id: r.id })));
  if (unannounced[0]) { const out = await postRelease(db, unannounced[0].id); if (out.posted) report.releasesPosted = 1; }

  // 3c. Version files: only the newest two per format keep theirs (safety net for the upload-time prune).
  report.versionsPruned = await pruneAllSlots(db);
  report.tmpCleared = await sweepTmpUploads(db);

  // 3d. Slack member IDs for anyone still missing one (email lookup; needs SLACK_BOT_TOKEN).
  report.slackMatched = (await matchSlackIds(db)).matched;

  // 4. Old watermark previews
  report.previews = await refreshStalePreviews(db, 20);
  return NextResponse.json({ ok: true, today, ...report });
}
