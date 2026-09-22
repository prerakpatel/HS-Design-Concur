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
    case "version.uploaded": return `${by !== "Someone" ? by + " uploaded " : ""}${f} v${p.number} for ${t}${by !== "Someone" ? "" : " is ready for review"}`;
    case "version.changes_requested": return `${by} requested changes on ${f} v${p.number}`;
    case "version.approved": return `${by} approved ${f} v${p.number}`;
    case "version.reopened": return `${by} reopened ${f} v${p.number} for changes`;
    case "comment.mention": return `${by} mentioned you on ${f}: “${p.excerpt ?? ""}”`;
    case "event.deleted": return `${t} was deleted`;
    case "draft.expiring": return `Your draft “${t}” is deleted in ${p.days} days unless someone edits it`;
    case "draft.swept": return `Your draft “${t}” sat untouched for 30 days and was deleted`;
    case "devices.refresh": return `Yearly check: refresh the phone preview presets to Figma’s current frame sizes (${p.year})`;
    default: return kind;
  }
}

/** One line for Google Chat: event · format vN · what happened, by whom. */
export function chatText(kind: string, p: Record<string, unknown>): string {
  const t = String(p.title ?? "an event"); const f = String(p.format ?? "a format"); const n = p.number ? ` v${p.number}` : ""; const by = String(p.by ?? "Someone");
  switch (kind) {
    case "version.uploaded": return `📤 ${t} · ${f}${n} uploaded by ${by} · ready for review`;
    case "version.approved": return `✅ ${t} · ${f}${n} approved by ${by}`;
    case "version.changes_requested": return `✏️ ${t} · ${f}${n} · changes requested by ${by}`;
    case "version.reopened": return `↩️ ${t} · ${f}${n} reopened by ${by}`;
    default: return `${t} · ${notificationText(kind, p)}`;
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
