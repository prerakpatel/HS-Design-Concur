import { APP_TIMEZONE } from "@/config/orgs";
import { REMINDER_LEAD_DAYS, REVIEW_WAIT_HOURS, UNSENT_NUDGE_HOURS } from "@/config/limits";
import { todayIso, daysFromNowIso, DAY_MS, HOUR_MS } from "@/lib/time";
import { NextResponse } from "next/server";
import { slotName } from "@/lib/project";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, appUrl, emailConfigured } from "@/lib/email";
import { notificationText, notificationHref, openLink, chatDate } from "@/lib/labels";
import { slackActionsEnabled, sendSlackBlocks } from "@/lib/slack-dm";
import { reminderBlocks, waitingBlocks, dueBlocks, MAX_REMINDER_ITEMS } from "@/lib/slack-blocks";
import { splitWaiting, waitingProjects, type WaitingSlot, type WaitingProject } from "@/lib/assets-waiting";
import { dueProjects, type DueSlot, type DueProject } from "@/lib/due-reminder";
import { notify, subjectFor, approverIds, type NotificationKind } from "@/lib/notify";
import { runRetention } from "@/lib/retention";
import { pruneAllSlots, sweepTmpUploads } from "@/lib/uploads/prune";
import { matchSlackIds } from "@/lib/slack";
import { mentionIds, groupMentionIds, plainText } from "@/lib/rich-text";
import { postRelease } from "@/lib/changelog";
import { RELEASES } from "@/config/changelog";
import { privateProjects } from "@/lib/project-people";
import { getActiveUser } from "@/lib/auth";

export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, 13:00 UTC ≈ morning in New York). Runs, in order:
 * 1. Due-date reminders: assets due today or in 3 days → one personal message per designer (in-app, push, Slack) and one
 *    short list of projects in the chat (no names).
 *    Then designs waiting ≥ 1 day for a decision → the approvers, once a day until approved or changes requested.
 * 2. Retention (PRD §8): archive + purge a week after the event date, hard-delete after the restore window,
 *    draft warning / sweep, yearly device-preset reminder. See src/lib/retention.ts.
 * 3. Daily digest email for users whose email_pref is "digest", then instant emails for job-created kinds.
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

  // 1. Assets due today or in 3 days. Collected here; the people who owe them are told personally in section 1d (one
  // message, one in-app item), and the organization's chat gets one short list of projects, never names.
  const { data: dueRaw } = await db.from("slots").select("id,due_on,assignee_id,event_id,label,formats(name),events(title,status,org_id,deleted_at)").eq("requested", true).neq("state", "approved").in("due_on", [today, in3]);
  type DueRow = { id: string; due_on: string; assignee_id: string | null; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string; org_id: string; deleted_at: string | null } };
  const dueRows = ((dueRaw ?? []) as unknown as DueRow[]).filter((d) => d.events.status === "active" && !d.events.deleted_at);

  const { data: orgRows } = await db.from("organisations").select("id,slug");
  const slugOf = new Map((orgRows ?? []).map((o) => [o.id as string, o.slug as string]));

  // 1b. Designs waiting for review for a day or more: one reminder per organization per day to its approvers (one
  // chat post, one push, one in-app item), listing every design, until each is decided.
  const { data: waiting } = await db.from("versions").select("id,number,sent_at,uploaded_by,slots!inner(id,event_id,state,label,formats(name),events(title,status,org_id,deleted_at)),uploader:uploaded_by(name,email)").eq("decision", "pending").not("sent_at", "is", null).lte("sent_at", new Date(Date.now() - REVIEW_WAIT_HOURS * HOUR_MS).toISOString()).eq("slots.state", "in_review");
  type Waiting = { eventId: string; slotId: string; versionId: string; title: string; format: string; number: number; days: number; by: string | undefined; since: string; uploadedBy: string };
  // Grouped per organization, except projects with their own chat or guests: each of those gets its own reminder in
  // its own chat, so its titles never reach the organization's channels. Key: "<org>" or "<org>|<event>".
  const privateWaiting = await privateProjects((waiting ?? []).map((v) => (v.slots as unknown as { event_id: string }).event_id));
  const waitingByOrg = new Map<string, Waiting[]>();
  for (const v of waiting ?? []) {
    const slot = v.slots as unknown as { id: string; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string; org_id: string; deleted_at: string | null } };
    if (slot.events.status !== "active" || slot.events.deleted_at) continue;
    const up = v.uploader as unknown as { name: string | null; email: string } | null;
    const row: Waiting = { eventId: slot.event_id, slotId: slot.id, versionId: v.id, title: slot.events.title, format: slotName(slot.formats.name, slot.label), number: v.number, days: Math.floor((Date.now() - new Date(v.sent_at).getTime()) / DAY_MS), by: up?.name ?? up?.email, since: v.sent_at, uploadedBy: v.uploaded_by };
    const key = privateWaiting.has(slot.event_id) ? `${slot.events.org_id}|${slot.event_id}` : slot.events.org_id;
    waitingByOrg.set(key, [...(waitingByOrg.get(key) ?? []), row]);
  }
  for (const [key, rows] of waitingByOrg) {
    const [orgId, privateEvent] = key.split("|");
    const approvers = await approverIds(db, orgId);
    if (approvers.length === 0) continue;
    rows.sort((a, b) => b.days - a.days);
    if (rows.length === 1) {
      const r = rows[0];
      const { data: dup } = await db.from("notifications").select("id").eq("kind", "review.waiting").contains("payload", { versionId: r.versionId, day: today }).limit(1);
      if (dup?.length) continue;
      await notify(db, approvers, "review.waiting", { eventId: r.eventId, slotId: r.slotId, versionId: r.versionId, title: r.title, format: r.format, number: r.number, by: r.by, since: r.since, days: r.days, day: today }, r.uploadedBy, { orgId });
    } else {
      // `scope` keeps the organisation-wide reminder apart from a project-specific one (both carry the same orgId).
      const scope = privateEvent ? { orgId, eventId: privateEvent, scope: "project" } : { orgId, scope: "org" };
      const { data: dup } = await db.from("notifications").select("id").eq("kind", "reviews.waiting").contains("payload", { ...scope, day: today }).limit(1);
      if (dup?.length) continue;
      const items = rows.slice(0, 15).map((r) => ({ title: r.title, format: r.format, number: r.number, days: r.days }));
      await notify(db, approvers, "reviews.waiting", { ...scope, day: today, count: rows.length, items, title: items.slice(0, 3).map((i) => `${i.title} · ${i.format}`).join(" · ") + (rows.length > 3 ? ` · +${rows.length - 3} more` : "") }, undefined, { orgId });
    }
    report.waiting = ((report.waiting as number) ?? 0) + rows.length;
  }

  // 1c. Review-mode comments nobody sent: nudge their author (in-app and push only, never chat), once a day.
  const { data: unsent } = await db.from("comments").select("author_id,version_id,versions!inner(number,slots!inner(id,event_id,label,formats(name),events(title,status,org_id,deleted_at)))").eq("is_draft", true).lte("created_at", new Date(Date.now() - UNSENT_NUDGE_HOURS * HOUR_MS).toISOString());
  const unsentBy = new Map<string, { author: string; row: NonNullable<typeof unsent>[number]; count: number }>();
  for (const c of unsent ?? []) { const k = `${c.author_id}:${c.version_id}`; const e = unsentBy.get(k); if (e) e.count++; else unsentBy.set(k, { author: c.author_id as string, row: c, count: 1 }); }
  report.unsent = 0;
  for (const [, u] of unsentBy) {
    const v = u.row.versions as unknown as { number: number; slots: { id: string; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string; deleted_at: string | null } } };
    if (v.slots.events.status !== "active" || v.slots.events.deleted_at) continue;
    const { data: dup } = await db.from("notifications").select("id").eq("user_id", u.author).eq("kind", "comments.unsent").contains("payload", { versionId: u.row.version_id, day: today }).limit(1);
    if (dup?.length) continue;
    await notify(db, [u.author], "comments.unsent", { eventId: v.slots.event_id, slotId: v.slots.id, versionId: u.row.version_id, title: v.slots.events.title, format: slotName(v.slots.formats.name, v.slots.label), number: v.number, count: u.count, day: today });
    report.unsent = (report.unsent as number) + 1;
  }

  // 1d. Change requests still open a day later: remind the person they were given to (the assignee, else the people
  // named) to mark them done, so nothing sits open by mistake. A plain comment has no "Mark as done", so it is never
  // owed. One in-app / push / email reminder per person per day, plus one chat post per organization listing which
  // assets have open change requests.
  type OpenComment = { id: string; author_id: string; body: string; mentions: string[] | null; assignee_id: string | null; versions: { number: number; slots: { id: string; event_id: string; label: string | null; formats: { name: string }; events: { title: string; status: string; org_id: string; deleted_at: string | null } } } };
  const { data: openRaw } = await db.from("comments").select("id,author_id,body,mentions,assignee_id,versions!inner(number,slots!inner(id,event_id,label,formats(name),events!inner(title,status,org_id,deleted_at)))").eq("is_draft", false).eq("needs_change", true).is("addressed_at", null).is("confirmed_at", null).lte("created_at", new Date(Date.now() - REVIEW_WAIT_HOURS * HOUR_MS).toISOString()).limit(2000);
  const openComments = ((openRaw ?? []) as unknown as OpenComment[]).filter((c) => ((c.mentions?.length ?? 0) > 0 || c.assignee_id) && c.versions.slots.events.status === "active" && !c.versions.slots.events.deleted_at);
  const groupIds = [...new Set(openComments.flatMap((c) => groupMentionIds(c.body)))];
  const { data: gm } = groupIds.length ? await db.from("group_members").select("group_id,user_id").in("group_id", groupIds) : { data: [] as { group_id: string; user_id: string }[] };
  const groupMembers = new Map<string, string[]>();
  for (const m of gm ?? []) groupMembers.set(m.group_id, [...(groupMembers.get(m.group_id) ?? []), m.user_id]);
  const { data: activeUsers } = await db.from("users").select("id,slack_user_id").eq("status", "active");
  const active = new Set((activeUsers ?? []).map((u) => u.id as string));
  const slackIdOf = new Map((activeUsers ?? []).filter((u) => u.slack_user_id).map((u) => [u.id as string, u.slack_user_id as string]));
  const slackButtons = slackActionsEnabled();
  report.slackReminders = 0;
  // Requested assets nothing has been uploaded to for a day or more. Their assignee is nudged personally (carried inside
  // the change-request message below when they are getting one anyway); the ones nobody is assigned to are listed, by
  // project, in the organization's chat on alternate days (under a divider when another reminder goes there too).
  const { data: waitRaw } = await db.from("slots").select("id,event_id,label,assignee_id,formats(name),events!inner(title,status,org_id,deleted_at)").eq("requested", true).eq("state", "requested").lte("updated_at", new Date(Date.now() - DAY_MS).toISOString());
  const waitingSlots: WaitingSlot[] = ((waitRaw ?? []) as unknown as { id: string; event_id: string; label: string | null; assignee_id: string | null; formats: { name: string }; events: { title: string; status: string; org_id: string; deleted_at: string | null } }[])
    .filter((w) => w.events.status === "active" && !w.events.deleted_at)
    .map((w) => ({ slotId: w.id, eventId: w.event_id, orgId: w.events.org_id, title: w.events.title, format: slotName(w.formats.name, w.label), assignee: w.assignee_id, url: appUrl(openLink(`/events/${w.event_id}/slots/${w.id}`, slugOf.get(w.events.org_id))) }));
  const { byPerson: waitingOf, unassigned: waitingFree } = splitWaiting(waitingSlots, active);
  const waitingInMessage = new Set<string>();
  const waitingItems = (list: WaitingSlot[]) => list.slice(0, MAX_REMINDER_ITEMS).map((w) => ({ title: w.title, format: w.format, url: w.url }));
  report.waitingNudges = 0;
  // Due: the assignee (if active) is told personally; all of it also goes into the chat's short list.
  const dueSlots: DueSlot[] = dueRows.map((d) => ({ slotId: d.id, eventId: d.event_id, orgId: d.events.org_id, title: d.events.title, format: slotName(d.formats.name, d.label), assignee: d.assignee_id, due: d.due_on, when: d.due_on === today ? "today" : "3d", url: appUrl(openLink(`/events/${d.event_id}/slots/${d.id}`, slugOf.get(d.events.org_id))) }));
  const { byPerson: dueOf } = splitWaiting(dueSlots, active);
  const dueWhen = (d: DueSlot) => (d.when === "today" ? "due today" : `due ${chatDate(d.due)}`);
  const dueItems = (list: DueSlot[]) => [...list].sort((a, b) => a.due.localeCompare(b.due)).slice(0, MAX_REMINDER_ITEMS).map((d) => ({ title: d.title, format: d.format, url: d.url, when: dueWhen(d) }));
  // One in-app / push item per person per day for each of the two kinds; someone already told today is skipped entirely.
  for (const person of [...dueOf.keys()]) { const { data: dup } = await db.from("notifications").select("id").eq("user_id", person).eq("kind", "slots.due").contains("payload", { day: today }).limit(1); if (dup?.length) dueOf.delete(person); }
  for (const [person] of [...waitingOf]) { const { data: dup } = await db.from("notifications").select("id").eq("user_id", person).eq("kind", "assets.waiting").contains("payload", { day: today }).limit(1); if (dup?.length) waitingOf.delete(person); }
  // person → org → open comments they were named in (never because a group they are in was named)
  const owed = new Map<string, Map<string, OpenComment[]>>();
  for (const c of openComments) {
    const viaGroup = new Set(groupIds.length ? groupMentionIds(c.body).flatMap((g) => groupMembers.get(g) ?? []) : []);
    const named = new Set(mentionIds(c.body));
    // The change was given to its assignee; without one, to whoever was named.
    for (const id of c.assignee_id ? [c.assignee_id] : (c.mentions ?? [])) {
      if (id === c.author_id || !active.has(id)) continue;
      if (!c.assignee_id && viaGroup.has(id) && !named.has(id)) continue;
      const orgs = owed.get(id) ?? new Map<string, OpenComment[]>();
      const org = c.versions.slots.events.org_id;
      orgs.set(org, [...(orgs.get(org) ?? []), c]); owed.set(id, orgs);
    }
  }
  report.openComments = 0;
  // Chat gets no names: one post per organization saying which assets still have open comments.
  const assetsByOrg = new Map<string, Map<string, { eventId: string; slotId: string; title: string; format: string; open: number; url: string }>>();
  const seenComment = new Set<string>();
  for (const [person, orgs] of owed) {
    const { data: dup } = await db.from("notifications").select("id").eq("user_id", person).eq("kind", "comments.pending").contains("payload", { day: today }).limit(1);
    if (dup?.length) continue;
    const all = [...orgs.values()].flat();
    const first = all[0].versions.slots;
    const places = [...new Map(all.map((c) => [c.versions.slots.id, `${c.versions.slots.events.title} · ${slotName(c.versions.slots.formats.name, c.versions.slots.label)}`])).values()];
    await notify(db, [person], "comments.pending", { count: all.length, day: today, href: `/events/${first.event_id}/slots/${first.id}`, title: places.slice(0, 3).join(" · ") + (places.length > 3 ? ` · +${places.length - 3} more` : ""), places: places.length });
    // A personal Slack message with a Mark as done button per change (only once Slack buttons are set up, and only for
    // people whose Slack account is known). Google Chat has no personal messages from a webhook: it gets the links below.
    const slackId = slackIdOf.get(person);
    if (slackButtons && slackId) {
      const items = all.slice(0, MAX_REMINDER_ITEMS).map((c) => { const sl = c.versions.slots; return { commentId: c.id, title: sl.events.title, format: slotName(sl.formats.name, sl.label), excerpt: plainText(c.body), url: appUrl(openLink(`/events/${sl.event_id}/slots/${sl.id}`, slugOf.get(sl.events.org_id))) }; });
      const mine = waitingOf.get(person) ?? [];
      const blocks = [...reminderBlocks(items, all.length - items.length, appUrl("/inbox")), ...(dueOf.has(person) ? dueBlocks(dueItems(dueOf.get(person)!), dueOf.get(person)!.length - Math.min(dueOf.get(person)!.length, MAX_REMINDER_ITEMS), appUrl("/inbox"), true) : []), ...(mine.length ? waitingBlocks(waitingItems(mine), mine.length - Math.min(mine.length, MAX_REMINDER_ITEMS), appUrl("/inbox"), true) : [])];
      const sent = await sendSlackBlocks(slackId, `${all.length} change${all.length === 1 ? " is" : "s are"} waiting on you in Design & Concur`, blocks);
      if ("error" in sent) console.error("[slack reminder]", sent.error); else { report.slackReminders = (report.slackReminders as number) + 1; waitingInMessage.add(person); }
    }
    for (const [org, list] of orgs) for (const c of list) {
      if (seenComment.has(c.id)) continue; seenComment.add(c.id);
      const sl = c.versions.slots; const m = assetsByOrg.get(org) ?? new Map();
      m.set(sl.id, { eventId: sl.event_id, slotId: sl.id, title: sl.events.title, format: slotName(sl.formats.name, sl.label), open: (m.get(sl.id)?.open ?? 0) + 1, url: appUrl(openLink(`/events/${sl.event_id}/slots/${sl.id}`, slugOf.get(org))) }); assetsByOrg.set(org, m);
    }
    report.openComments = (report.openComments as number) + all.length;
  }
  // Everyone with something due or waiting gets one in-app / push item a day per kind; on Slack it is the message above
  // when they had open changes, otherwise one message of its own with both parts.
  for (const person of new Set([...dueOf.keys(), ...waitingOf.keys()])) {
    const dueList = dueOf.get(person) ?? []; const list = waitingOf.get(person) ?? [];
    const names = (xs: { title: string }[]) => { const places = [...new Set(xs.map((x) => x.title))]; return places.slice(0, 3).join(" · ") + (places.length > 3 ? ` · +${places.length - 3} more` : ""); };
    if (dueList.length) await notify(db, [person], "slots.due", { count: dueList.length, today: dueList.filter((d) => d.when === "today").length, day: today, href: `/events/${dueList[0].eventId}/slots/${dueList[0].slotId}`, title: names(dueList) });
    if (list.length) await notify(db, [person], "assets.waiting", { count: list.length, day: today, href: `/events/${list[0].eventId}/slots/${list[0].slotId}`, title: names(list) });
    const slackId = slackIdOf.get(person);
    if (slackButtons && slackId && !waitingInMessage.has(person)) {
      const blocks = [...(dueList.length ? dueBlocks(dueItems(dueList), dueList.length - Math.min(dueList.length, MAX_REMINDER_ITEMS), appUrl("/inbox"), false) : []), ...(list.length ? waitingBlocks(waitingItems(list), list.length - Math.min(list.length, MAX_REMINDER_ITEMS), appUrl("/inbox"), dueList.length > 0) : [])];
      const sent = await sendSlackBlocks(slackId, `${dueList.length ? "Assets are due soon" : "Requested assets are waiting for your upload"} in Design & Concur`, blocks);
      if ("error" in sent) console.error("[slack reminders]", sent.error);
    }
    report.reminders = (report.reminders as number) + dueList.length; report.waitingNudges = (report.waitingNudges as number) + (list.length ? 1 : 0);
  }
  // The chat hears which projects have assets due (a short list, no names, no @mention): one post per organization, or
  // in its own chat for a project that has one.
  const privateDue = await privateProjects(dueSlots.map((d) => d.eventId));
  const dueGroups = new Map<string, DueSlot[]>();
  for (const d of dueSlots) { const k = privateDue.has(d.eventId) ? `${d.orgId}|${d.eventId}` : d.orgId; dueGroups.set(k, [...(dueGroups.get(k) ?? []), d]); }
  for (const [k, list] of dueGroups) {
    const projects = dueProjects(list, (d) => appUrl(openLink(`/events/${d.eventId}`, slugOf.get(d.orgId))));
    await notify(db, [], "slots.due", { projects: projects.slice(0, 15) as DueProject[], total: projects.length, day: today, orgId: list[0].orgId, ...(k.includes("|") ? { eventId: list[0].eventId } : {}) }, undefined, { orgId: list[0].orgId, mention: [] });
    report.duePosts = ((report.duePosts as number) ?? 0) + 1;
  }
  // The whole-channel ping goes out on alternate days; the post itself is daily.
  const pingToday = Math.floor(new Date(`${today}T00:00:00Z`).getTime() / DAY_MS) % 2 === 0;
  // As above: a project with its own chat or guests gets its own post there; the rest one post per organization.
  const privateOpen = await privateProjects([...assetsByOrg.values()].flatMap((m) => [...m.values()].map((a) => a.eventId)).concat(waitingFree.map((w) => w.eventId)));
  // Unassigned waiting assets, per chat: key "<org>" or "<org>|<event>" (a project with its own chat or guests), on ping days only.
  const waitingPosts = new Map<string, { orgId: string; eventId?: string; projects: WaitingProject[]; total: number }>();
  if (pingToday) {
    const groups = new Map<string, WaitingSlot[]>();
    for (const w of waitingFree) { const k = privateOpen.has(w.eventId) ? `${w.orgId}|${w.eventId}` : w.orgId; groups.set(k, [...(groups.get(k) ?? []), w]); }
    for (const [k, list] of groups) {
      const projects = waitingProjects(list, (w) => appUrl(openLink(`/events/${w.eventId}`, slugOf.get(w.orgId))));
      waitingPosts.set(k, { orgId: list[0].orgId, ...(k.includes("|") ? { eventId: list[0].eventId } : {}), projects: projects.slice(0, 15), total: projects.length });
    }
  }
  for (const [orgId, byAsset] of assetsByOrg) {
    const all = [...byAsset.values()];
    const posts = [all.filter((a) => !privateOpen.has(a.eventId)), ...[...new Set(all.map((a) => a.eventId))].filter((id) => privateOpen.has(id)).map((id) => all.filter((a) => a.eventId === id))];
    for (const group of posts) {
      if (!group.length) continue;
      const assets = group.sort((x, y) => y.open - x.open).slice(0, 15);
      const own = privateOpen.has(group[0].eventId);
      const key = own ? `${orgId}|${group[0].eventId}` : orgId;
      const bundle = waitingPosts.get(key); waitingPosts.delete(key);
      await notify(db, [], "comments.pending", { assets, total: group.length, day: today, orgId, pingAll: pingToday, ...(bundle ? { waiting: bundle.projects, waitingTotal: bundle.total } : {}), ...(assets.length === 1 || own ? { eventId: assets[0].eventId } : {}), ...(assets.length === 1 ? { slotId: assets[0].slotId } : {}) }, undefined, { orgId, mention: [] });
    }
  }
  // Anything left has no other reminder to ride along with: a short post of its own.
  for (const post of waitingPosts.values()) {
    await notify(db, [], "assets.waiting", { waiting: post.projects, total: post.total, day: today, orgId: post.orgId, ...(post.eventId ? { eventId: post.eventId } : {}) }, undefined, { orgId: post.orgId, mention: [] });
    report.waitingPosts = ((report.waitingPosts as number) ?? 0) + 1;
  }

  // 2. Retention (+ tell the creator and the chat that an event was archived)
  const retention = await runRetention(db, { tz, today });
  for (const ev of retention.archivedEvents) await notify(db, [ev.created_by], "event.archived", { eventId: ev.id, title: ev.title, kind: ev.kind }, undefined, { orgId: ev.org_id });
  report.retention = { ...retention, archivedEvents: retention.archivedEvents.map((e) => e.title) };

  // 3. Daily digest
  if (emailConfigured()) {
    const { data: users } = await db.from("users").select("id,email,name").eq("status", "active").eq("email_pref", "digest");
    for (const u of users ?? []) {
      const { data: rows } = await db.from("notifications").select("id,kind,payload,organisations(slug,email_enabled)").eq("user_id", u.id).is("emailed_at", null).gte("created_at", new Date(Date.now() - 2 * DAY_MS).toISOString()).order("created_at", { ascending: false }).limit(30);
      // An organisation with email switched off is left out (those rows stay unmailed; they are still in the Inbox).
      const items = (rows ?? []).filter((n) => ((n.organisations as unknown as { email_enabled: boolean | null } | null)?.email_enabled ?? true));
      if (!items.length) continue;
      const lines = items.map((n) => `• ${notificationText(n.kind, n.payload as Record<string, unknown>)}`).join("\n");
      const r = await sendEmail(u.email, `Design & Concur: ${items.length} update${items.length === 1 ? "" : "s"}`, { heading: "Your daily digest", body: lines, cta: { label: "Open Inbox", href: appUrl(items.length === 1 ? openLink(notificationHref(items[0].payload as Record<string, unknown>), (items[0].organisations as unknown as { slug: string } | null)?.slug) : "/inbox") } });
      if ("ok" in r) { await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", items.map((n) => n.id)); report.digests = (report.digests as number) + 1; }
    }
    // Instant users also get, by email, the job-created notifications that do not go through notify() (which already
    // emails them after the job responds: listing those here as well would send each one twice).
    const { data: instant } = await db.from("notifications").select("id,user_id,kind,payload,users!inner(email,email_pref,status)").in("kind", ["draft.expiring", "draft.swept", "devices.refresh"]).is("emailed_at", null).gte("created_at", new Date(Date.now() - 2 * DAY_MS).toISOString()).eq("users.email_pref", "instant").eq("users.status", "active");
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

  return NextResponse.json({ ok: true, today, ...report });
}
