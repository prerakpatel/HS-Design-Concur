import { isOnSitePath } from "@/lib/on-site-path";
import { assetBullet } from "@/lib/chat-bullets";
import { REMINDER_LEAD_DAYS, DRAFT_SWEEP_DAYS } from "@/config/limits";
import { APP_TIMEZONE } from "@/config/orgs";
import type { Format } from "@/lib/types";
import { dueChatBody, type DueProject } from "@/lib/due-reminder";
import { waitingChatSection, type WaitingProject } from "@/lib/assets-waiting";

export function formatSize(f: Pick<Format, "width" | "height" | "unit" | "allow_custom_size">, custom?: { w: number | null; h: number | null }) {
  if (f.allow_custom_size && custom?.w && custom?.h) return `${custom.w} × ${custom.h} px`;
  if (f.width == null || f.height == null) return f.allow_custom_size ? "custom size" : "";
  return f.unit === "in" ? `${f.width} × ${f.height} in` : `${f.width} × ${f.height}`;
}

export function notificationText(kind: string, p: Record<string, unknown>): string {
  const t = String(p.title ?? ""); const f = String(p.format ?? ""); const by = String(p.by ?? "Someone");
  switch (kind) {
    case "access.approved": return `Your access was approved by ${by}`;
    case "slot.assigned": return `You were assigned ${f} for ${t}`;
    case "slot.due": return `${f} for ${t} is ${p.when === "today" ? "due today" : `due in ${REMINDER_LEAD_DAYS} days`}`;
    case "event.published": return `${t} was published and needs designs`;
    case "project.ending": return `${t} ends in ${REMINDER_LEAD_DAYS} days. Download the final designs; the files are cleared after the end date.`;
    case "version.uploaded": return `${by} sent ${f} v${p.number} for review`;
    case "review.waiting": return `${f} v${p.number} for ${t} has been waiting ${p.days} day${p.days === 1 ? "" : "s"} for review`;
    case "reviews.waiting": return `${p.count} designs are waiting for your review`;
    case "slots.due": return `${p.count} asset${p.count === 1 ? " is" : "s are"} due${p.today ? ` (${p.today} today)` : ""}${p.title ? `: ${p.title}` : ""}`;
    case "assets.waiting": return `${p.count} requested asset${p.count === 1 ? " is" : "s are"} still waiting for an upload${p.title ? `: ${p.title}` : ""}`;
    case "comments.pending": return `You have ${p.count} comment${p.count === 1 ? "" : "s"} still open. Mark ${p.count === 1 ? "it" : "them"} as done once handled${p.title ? `: ${p.title}` : ""}`;
    case "version.changes_requested": return `${by} requested changes on ${f} v${p.number}`;
    case "changes.requested": return `${by} requested ${Number(p.count) > 1 ? `${p.count} changes` : "a change"} on ${f} v${p.number}`;
    case "version.approved": return `${by} approved ${f} v${p.number}`;
    case "primary.approved": return `Congrats! The primary design for ${t} (${f}) is approved. You can start the other formats now.`;
    case "version.reopened": return `${by} reopened ${f} v${p.number} for changes`;
    case "comment.mention": return `${by} mentioned you on ${f}: “${p.excerpt ?? ""}”`;
    case "comment.posted": return `${by} commented on ${f}: “${p.excerpt ?? ""}”`;
    case "comments.posted": return `${by} left ${p.count} comments on ${f}`;
    case "comments.unsent": return `You have ${p.count} unsent comment${p.count === 1 ? "" : "s"} on ${f} for ${t}. Open it to send or discard them.`;
    case "versions.approved": return `${by} approved ${p.count} designs for ${t}`;
    case "event.all_approved": return `All designs for ${t} are approved`;
    case "access.requested": return `${p.name ?? p.email} asked for access`;
    case "event.archived": return p.kind === "assets" ? `${t} has ended; its files were cleared` : `${t} was archived; one reference image was kept`;
    case "event.deleted": return `${t} was deleted`;
    case "draft.expiring": return `Your draft “${t}” is deleted in ${p.days} days unless someone edits it`;
    case "draft.swept": return `Your draft “${t}” sat untouched for ${DRAFT_SWEEP_DAYS} days and was deleted`;
    case "devices.refresh": return `Yearly check: refresh the phone preview presets to Figma’s current frame sizes (${p.year})`;
    default: return kind;
  }
}

/** One line for Google Chat: event · format vN · what happened, by whom. */
/** Event date for chat posts: "Sat, Nov 14". Date-only strings are read at noon so the weekday never shifts. */
export function chatDate(d: unknown) {
  if (typeof d !== "string" || !d) return "";
  // Date-only strings are calendar days (noon, so no shifting); a timestamp is shown in the app's own time zone, not the server's.
  const day = d.length === 10;
  return new Date(day ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(day ? {} : { timeZone: APP_TIMEZONE }) });
}
const quote = (s: unknown) => (typeof s === "string" && s.trim() ? (s.includes("\n") ? `\n${s.trim()}` : `“${s.trim()}”`) : "");
/**
 * Chat post body: a bold first line (emoji · event · format) and a plain second line saying what happened.
 * `{@<userId>}` placeholders become a real @mention (or a bold name) per platform in notify().
 */
const waitingList = (p: Record<string, unknown>) => (Array.isArray(p.waiting) ? p.waiting as WaitingProject[] : []);
/** Unassigned assets still waiting for an upload, added under another reminder with a divider. */
const waitingPart = (p: Record<string, unknown>) => (waitingList(p).length ? waitingChatSection(waitingList(p), Number(p.waitingTotal ?? 0), true).split("\n") : []);

export function chatLines(kind: string, p: Record<string, unknown>): { head: string; body: string } {
  const t = String(p.title ?? "an event"); const f = String(p.format ?? "a format"); const n = p.number ? ` v${p.number}` : ""; const by = String(p.by ?? "Someone");
  const q = quote(p.excerpt);
  switch (kind) {
    case "event.published": {
      const rows = (Array.isArray(p.assignments) ? p.assignments as { format: string; userId: string | null; due?: string | null }[] : [])
        .map((a) => `• ${a.format} → ${a.userId ? `{@${a.userId}}` : "unassigned"}${a.due ? ` · due ${chatDate(a.due)}` : ""}`);
      if (p.kind === "assets") return { head: `🆕 ${t} · assets, ends ${chatDate(p.date)}`, body: [`New request published by ${by}.`, ...rows].join("\n") };
      return { head: `🆕 ${t}${p.date ? ` · ${chatDate(p.date)}` : ""}`, body: [`New event published by ${by}${p.venue ? ` · ${p.venue}` : ""}.`, ...rows].join("\n") };
    }
    case "slot.assigned": return { head: `🎯 ${t} · ${f}`, body: `${by} assigned this to {@${p.assignee}}${p.due ? ` · due ${chatDate(p.due)}` : ""}.` };
    case "slot.due": return { head: `⏰ ${t} · ${f}`, body: `{@${p.assignee}} this is due ${p.when === "today" ? "today" : `in ${REMINDER_LEAD_DAYS} days`}${p.due ? ` (${chatDate(p.due)})` : ""}.` };
    case "version.uploaded": return { head: `📤 ${t} · ${f}${n}`, body: `Sent for review by ${by}.` };
    case "review.waiting": return { head: `⏳ ${t} · ${f}${n}`, body: `Waiting for review since ${chatDate(p.since)} · ${p.days} day${p.days === 1 ? "" : "s"}. Approve it or request changes.` };
    case "comments.pending": {
      const assets = (Array.isArray(p.assets) ? p.assets as { title: string; format: string; open: number; url?: string }[] : []);
      const more = Number(p.total ?? assets.length) - assets.length;
      return { head: "✅ Open changes need resolving", body: [...assets.map(assetBullet), ...(more > 0 ? [`• and ${more} more`] : []), "Once a change is handled, tap Mark as done so nobody wonders what is still open.", ...waitingPart(p)].join("\n") };
    }
    case "slots.due": {
      const projects = (Array.isArray(p.projects) ? p.projects as DueProject[] : []);
      return { head: "⏰ Due soon", body: dueChatBody(projects, Number(p.total ?? projects.length), `in ${REMINDER_LEAD_DAYS} days`) };
    }
    case "assets.waiting": return { head: "📥 Waiting on assets", body: waitingChatSection(waitingList(p), Number(p.total ?? 0), false).split("\n").slice(1).join("\n") };
    case "reviews.waiting": {
      const items = (Array.isArray(p.items) ? p.items as { title: string; format: string; number: number; days: number }[] : []);
      const more = Number(p.count) - items.length;
      return { head: `⏳ ${p.count} designs waiting for review`, body: [...items.map((i) => `• ${i.title} · ${i.format} v${i.number} · ${i.days} day${i.days === 1 ? "" : "s"}`), ...(more > 0 ? [`• and ${more} more`] : []), "Approve them or request changes."].join("\n") };
    }
    case "version.approved": return { head: `✅ ${t} · ${f}${n}`, body: `Approved by ${by}.` };
    case "primary.approved": return { head: `🎉 ${t} · primary design approved`, body: `Congrats! The primary design (${f}${n}) has been approved by ${by}. Designers can now start creating the other formats from it.` };
    case "versions.approved": return { head: `✅ ${t} · ${p.count} designs approved`, body: `${by} approved ${String(p.formats ?? "")}.` };
    case "event.all_approved": return { head: `🎉 ${t} · all designs approved`, body: `${p.count} format${p.count === 1 ? "" : "s"} final and ready to publish.` };
    case "version.changes_requested": return { head: `✏️ ${t} · ${f}${n}`, body: `${by} requested changes${q ? `: ${q}` : "."}` };
    case "version.reopened": return { head: `↩️ ${t} · ${f}${n}`, body: `Reopened by ${by}${q ? `: ${q}` : "."}` };
    case "comment.mention": return { head: `💬 ${t} · ${f}${n}`, body: `${by}: ${q}` };
    case "comment.posted": return { head: `💬 ${t} · ${f}${n}`, body: `${by}: ${q}` };
    case "comments.posted": return { head: `💬 ${t} · ${f}${n}`, body: `${by}:\n${String(p.excerpt ?? "")}` };
    case "changes.requested": {
      const who = (Array.isArray(p.assignees) ? p.assignees as string[] : []).map((id) => `{@${id}}`).join(" ");
      return { head: p.reopened ? `↩️ ${t} · ${f}${n} · reopened with changes` : `✏️ ${t} · ${f}${n} · changes needed`, body: `${by}${who ? ` asked ${who} to` : ""} change${Number(p.count) > 1 ? ` ${p.count} things` : ""}:\n${String(p.excerpt ?? "")}` };
    }
    case "access.requested": return { head: `🔑 ${p.name ?? p.email} asked for access`, body: `${p.email} · approve or deny in Settings → Requests.` };
    case "access.approved": return { head: `👋 ${p.name ?? "A new member"} joined`, body: `Approved by ${by}. Welcome!` };
    case "project.ending": return { head: `⏳ ${t} · ends in ${REMINDER_LEAD_DAYS} days`, body: "Download the final designs now: the files are cleared after the end date." };
    case "event.archived": return p.kind === "assets" ? { head: `📦 ${t} ended`, body: "The request reached its end date and its files were cleared." } : { head: `📦 ${t} archived`, body: "A week has passed since the event. One reference image was kept; the other files were removed." };
    default: return { head: t, body: notificationText(kind, p) };
  }
}
export function notificationHref(p: Record<string, unknown>): string {
  // Only an on-site path: a notification must never send someone to another website.
  if (isOnSitePath(p.href)) return p.href;
  if (p.eventId && p.slotId) return `/events/${p.eventId}/slots/${p.slotId}`;
  if (p.eventId) return `/events/${p.eventId}`;
  return "/events";
}

/** `/open` switches to the organisation (when the person belongs to it) and then goes to the page. */
export function openLink(path: string, orgSlug?: string | null) {
  return orgSlug ? `/open?org=${encodeURIComponent(orgSlug)}&to=${encodeURIComponent(path)}` : path;
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "asset";

/** Download name: year_event_format_v1.ext (PRD §7): "2026_jal-jhilani-utsav_ig-post_v1.jpg". */
export function assetFilename(o: { eventDate: string | null; eventTitle: string; formatName: string; side?: string; number: number; path: string }) {
  const year = o.eventDate?.slice(0, 4) ?? new Date().getFullYear();
  const ext = o.path.split(".").pop() ?? "jpg";
  return `${year}_${slugify(o.eventTitle)}_${slugify(o.formatName)}${o.side === "back" ? "-back" : ""}_v${o.number}.${ext}`;
}
