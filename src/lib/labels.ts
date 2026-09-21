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
    default: return kind;
  }
}

export function notificationHref(p: Record<string, unknown>): string {
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
