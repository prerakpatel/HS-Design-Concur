import { ASSET_MAX_DAYS, EVENT_CAP } from "@/config/limits";
import type { Organization } from "@/lib/types";

/**
 * A project is an event (date, venue, invite text) or an assets-only request (a description and an end
 * date at most 30 days out). Both live in the events table; `kind` tells them apart.
 */
export type ProjectKind = "event" | "assets";
export const isAssets = (p: { kind?: string | null } | null | undefined) => p?.kind === "assets";

/** What a slot is called: the format, plus the item's own name when a request has several of it. */
export function slotName(formatName: string | null | undefined, label?: string | null) {
  const f = formatName || "Format";
  return label ? `${f} · ${label}` : f;
}

/** Published projects an organisation may have at once (Settings can change it per org). */
export const capFor = (org: Pick<Organization, "event_cap">) => org.event_cap ?? EVENT_CAP;

/** Latest end date an assets-only request may have, as yyyy-mm-dd. */
export function assetEndMax(from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + ASSET_MAX_DAYS); return d.toLocaleDateString("en-CA"); }

/** Items of a request in a steady order: by format, then by name (numbers in order: 2 before 10). */
export const byFormatThenLabel = (a: { sort: number; label?: string | null }, b: { sort: number; label?: string | null }) =>
  a.sort - b.sort || (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true });
