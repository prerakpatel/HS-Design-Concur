import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { getActiveUser } from "@/lib/auth";
import { BUCKET } from "@/lib/storage";
import { assetFilename, slugify } from "@/lib/labels";

export const maxDuration = 60;

/**
 * One ZIP of every approved design in the event, named like the single downloads
 * (year_event_format_vN.ext, "-back" for the back of a print piece). Archived events have only reference
 * images left, so those are what they get. Anyone on the org can download; the files are already approved.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getActiveUser();
  if (!ctx) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { supabase, org } = ctx;
  const { data: event } = await supabase.from("events").select("id,org_id,title,event_date").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!event || event.org_id !== org.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: slots } = await supabase.from("slots").select("id,formats(name,sort),versions(number,decision,version_sides(side,optimised_path,reference_path))").eq("event_id", id).eq("requested", true).eq("state", "approved");

  const files: Record<string, Uint8Array> = {};
  const missing: string[] = [];
  const rows = [...(slots ?? [])].sort((a, b) => ((a.formats as unknown as { sort: number })?.sort ?? 0) - ((b.formats as unknown as { sort: number })?.sort ?? 0));
  for (const slot of rows) {
    const fmt = slot.formats as unknown as { name: string } | null;
    const approved = (slot.versions as { number: number; decision: string; version_sides: { side: string; optimised_path: string | null; reference_path: string | null }[] }[]).find((v) => v.decision === "approved");
    if (!approved) continue;
    for (const side of approved.version_sides.sort((a, b) => (a.side === "front" ? -1 : 1) - (b.side === "front" ? -1 : 1))) {
      const path = side.optimised_path ?? side.reference_path;
      if (!path) { missing.push(fmt?.name ?? "format"); continue; }
      const { data: file } = await supabase.storage.from(BUCKET).download(path);
      if (!file) { missing.push(fmt?.name ?? "format"); continue; }
      files[assetFilename({ eventDate: event.event_date, eventTitle: event.title, formatName: fmt?.name ?? "format", side: side.side, number: approved.number, path })] = new Uint8Array(await file.arrayBuffer());
    }
  }
  if (Object.keys(files).length === 0) return NextResponse.json({ error: "Nothing approved to download yet" }, { status: 404 });
  if (missing.length) files["README.txt"] = strToU8(`Not included (files no longer stored): ${[...new Set(missing)].join(", ")}\n`);
  const zip = zipSync(files, { level: 0 }); // images are already compressed; store them as-is
  const name = `${event.event_date?.slice(0, 4) ?? new Date().getFullYear()}_${slugify(event.title)}_approved.zip`;
  return new Response(new Uint8Array(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
