import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, appUrl, emailConfigured } from "@/lib/email";
import { notificationText, notificationHref } from "@/lib/labels";
import { subjectFor, type NotificationKind } from "@/lib/notify";
import { runRetention } from "@/lib/retention";

export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, 13:00 UTC ≈ morning in New York). Runs, in order:
 * 1. Due-date reminders: slots due today or in 3 days → in-app notification (+ instant email via digest below).
 * 2. Retention (PRD §8): archive + purge a week after the event date, hard-delete after the restore window,
 *    draft warning / sweep, yearly device-preset reminder. See src/lib/retention.ts.
 * 3. Daily digest email for users whose email_pref is "digest", then instant emails for job-created kinds.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE ?? "America/New_York" });
  const in3 = new Date(Date.now() + 3 * 86400_000).toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE ?? "America/New_York" });
  const tz = process.env.APP_TIMEZONE ?? "America/New_York";
  const report: Record<string, unknown> = { reminders: 0, digests: 0 };

  // 1. Due-date reminders
  const { data: due } = await db.from("slots").select("id,due_on,assignee_id,event_id,formats(name),events(title,status)").eq("requested", true).neq("state", "approved").not("assignee_id", "is", null).in("due_on", [today, in3]);
  for (const s of due ?? []) {
    const ev = s.events as unknown as { title: string; status: string }; if (ev.status !== "active") continue;
    const payload = { eventId: s.event_id, slotId: s.id, title: ev.title, format: (s.formats as unknown as { name: string }).name, when: s.due_on === today ? "today" : "3d" };
    const { data: dup } = await db.from("notifications").select("id").eq("user_id", s.assignee_id).eq("kind", "slot.due").contains("payload", { slotId: s.id, when: payload.when }).limit(1);
    if (dup?.length) continue;
    await db.from("notifications").insert({ user_id: s.assignee_id, kind: "slot.due", payload });
    report.reminders = (report.reminders as number) + 1;
  }

  // 2. Retention
  report.retention = await runRetention(db, { tz, today });

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
    const { data: instant } = await db.from("notifications").select("id,user_id,kind,payload,users!inner(email,email_pref,status)").in("kind", ["slot.due", "draft.expiring", "draft.swept", "devices.refresh"]).is("emailed_at", null).eq("users.email_pref", "instant").eq("users.status", "active");
    for (const n of instant ?? []) {
      const u = n.users as unknown as { email: string }; const p = n.payload as Record<string, unknown>;
      const r = await sendEmail(u.email, subjectFor(n.kind as NotificationKind, p), { heading: notificationText(n.kind, p), body: String(p.title ?? ""), cta: { label: "Open Design & Concur", href: appUrl(notificationHref(p)) } });
      if ("ok" in r) await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
    }
  }
  return NextResponse.json({ ok: true, today, ...report });
}
