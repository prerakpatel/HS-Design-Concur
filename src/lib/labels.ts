import type { Format } from "@/lib/types";

export function formatSize(f: Pick<Format, "width" | "height" | "unit" | "allow_custom_size">, custom?: { w: number | null; h: number | null }) {
  if (f.allow_custom_size) return custom?.w && custom?.h ? `${custom.w} × ${custom.h} px` : "custom size";
  if (f.width == null || f.height == null) return "";
  return f.unit === "in" ? `${f.width} × ${f.height} in` : `${f.width} × ${f.height}`;
}

export function notificationText(kind: string, p: Record<string, unknown>): string {
  const t = String(p.title ?? ""); const f = String(p.format ?? ""); const by = String(p.by ?? "Someone");
  switch (kind) {
    case "access.approved": return `Your access was approved by ${by}`;
    case "slot.assigned": return `You were assigned ${f} for ${t}`;
    case "slot.due": return `${f} for ${t} is ${p.when === "today" ? "due today" : "due in 3 days"}`;
    case "event.published": return `${t} was published and needs designs`;
    case "version.uploaded": return `${by} sent ${f} v${p.number} for review`;
    case "review.waiting": return `${f} v${p.number} for ${t} has been waiting ${p.days} day${p.days === 1 ? "" : "s"} for review`;
    case "version.changes_requested": return `${by} requested changes on ${f} v${p.number}`;
    case "version.approved": return `${by} approved ${f} v${p.number}`;
    case "version.reopened": return `${by} reopened ${f} v${p.number} for changes`;
    case "comment.mention": return `${by} mentioned you on ${f}: “${p.excerpt ?? ""}”`;
    case "comment.posted": return `${by} commented on ${f}: “${p.excerpt ?? ""}”`;
    case "versions.approved": return `${by} approved ${p.count} designs for ${t}`;
    case "event.all_approved": return `All designs for ${t} are approved`;
    case "access.requested": return `${p.name ?? p.email} asked for access`;
    case "event.archived": return `${t} was archived; one reference image was kept`;
    case "event.deleted": return `${t} was deleted`;
    case "draft.expiring": return `Your draft “${t}” is deleted in ${p.days} days unless someone edits it`;
    case "draft.swept": return `Your draft “${t}” sat untouched for 30 days and was deleted`;
    case "devices.refresh": return `Yearly check: refresh the phone preview presets to Figma’s current frame sizes (${p.year})`;
    default: return kind;
  }
}

/** One line for Google Chat: event · format vN · what happened, by whom. */
/** Event date for chat posts: "Sat, Nov 14". Date-only strings are read at noon so the weekday never shifts. */
export function chatDate(d: unknown) {
  if (typeof d !== "string" || !d) return "";
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
const quote = (s: unknown) => (typeof s === "string" && s.trim() ? `“${s.trim()}”` : "");
/**
 * Chat post body: a bold first line (emoji · event · format) and a plain second line saying what happened.
 * `{@<userId>}` placeholders become a real @mention (or a bold name) per platform in notify().
 */
export function chatLines(kind: string, p: Record<string, unknown>): { head: string; body: string } {
  const t = String(p.title ?? "an event"); const f = String(p.format ?? "a format"); const n = p.number ? ` v${p.number}` : ""; const by = String(p.by ?? "Someone");
  const q = quote(p.excerpt);
  switch (kind) {
    case "event.published": {
      const rows = (Array.isArray(p.assignments) ? p.assignments as { format: string; userId: string | null; due?: string | null }[] : [])
        .map((a) => `• ${a.format} → ${a.userId ? `{@${a.userId}}` : "unassigned"}${a.due ? ` · due ${chatDate(a.due)}` : ""}`);
      return { head: `🆕 ${t}${p.date ? ` · ${chatDate(p.date)}` : ""}`, body: [`New event published by ${by}${p.venue ? ` · ${p.venue}` : ""}.`, ...rows].join("\n") };
    }
    case "slot.assigned": return { head: `🎯 ${t} · ${f}`, body: `${by} assigned this to {@${p.assignee}}${p.due ? ` · due ${chatDate(p.due)}` : ""}.` };
    case "slot.due": return { head: `⏰ ${t} · ${f}`, body: `{@${p.assignee}} this is due ${p.when === "today" ? "today" : "in 3 days"}${p.due ? ` (${chatDate(p.due)})` : ""}.` };
    case "version.uploaded": return { head: `📤 ${t} · ${f}${n}`, body: `Sent for review by ${by}.` };
    case "review.waiting": return { head: `⏳ ${t} · ${f}${n}`, body: `Waiting for review since ${chatDate(p.since)} · ${p.days} day${p.days === 1 ? "" : "s"}. Approve it or request changes.` };
    case "version.approved": return { head: `✅ ${t} · ${f}${n}`, body: `Approved by ${by}.` };
    case "versions.approved": return { head: `✅ ${t} · ${p.count} designs approved`, body: `${by} approved ${String(p.formats ?? "")}.` };
    case "event.all_approved": return { head: `🎉 ${t} · all designs approved`, body: `${p.count} format${p.count === 1 ? "" : "s"} final and ready to publish.` };
    case "version.changes_requested": return { head: `✏️ ${t} · ${f}${n}`, body: `${by} requested changes${q ? `: ${q}` : "."}` };
    case "version.reopened": return { head: `↩️ ${t} · ${f}${n}`, body: `Reopened by ${by}${q ? `: ${q}` : "."}` };
    case "comment.mention": return { head: `💬 ${t} · ${f}${n}`, body: `${by}: ${q}` };
    case "comment.posted": return { head: `💬 ${t} · ${f}${n}`, body: `${by} commented: ${q}` };
    case "access.requested": return { head: `🔑 ${p.name ?? p.email} asked for access`, body: `${p.email} · approve or deny in Settings → Requests.` };
    case "access.approved": return { head: `👋 ${p.name ?? "A new member"} joined`, body: `Approved by ${by}. Welcome!` };
    case "event.archived": return { head: `📦 ${t} archived`, body: "A week has passed since the event. One reference image was kept; the other files were removed." };
    default: return { head: t, body: notificationText(kind, p) };
  }
}
export function notificationHref(p: Record<string, unknown>): string {
  if (typeof p.href === "string") return p.href;
  if (p.eventId && p.slotId) return `/events/${p.eventId}/slots/${p.slotId}`;
  if (p.eventId) return `/events/${p.eventId}`;
  return "/events";
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "asset";

/** Download name: year_event_format_v1.ext (PRD §7): "2026_jal-jhilani-utsav_ig-post_v1.jpg". */
export function assetFilename(o: { eventDate: string | null; eventTitle: string; formatName: string; side?: string; number: number; path: string }) {
  const year = o.eventDate?.slice(0, 4) ?? new Date().getFullYear();
  const ext = o.path.split(".").pop() ?? "jpg";
  return `${year}_${slugify(o.eventTitle)}_${slugify(o.formatName)}${o.side === "back" ? "-back" : ""}_v${o.number}.${ext}`;
}
