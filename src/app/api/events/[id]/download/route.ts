import { NextResponse } from "next/server";
import { slotName } from "@/lib/project";
import { zipSync, strToU8 } from "fflate";
import { getViewer, projectContext } from "@/lib/auth";
import { readFile } from "@/lib/files";
import { assetFilename, slugify } from "@/lib/labels";

export const maxDuration = 60;

/**
 * One ZIP of every approved design in the event, named like the single downloads
 * (year_event_format_vN.ext, "-back" for the back of a print piece). Archived events have only reference
 * images left, so those are what they get. Anyone who can open the project can download (its organization, and its
 * guests); the files are already approved. `?slot=` limits it to one format (its front and back).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slotId = new URL(req.url).searchParams.get("slot");
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { supabase } = viewer;
  const { data: event } = await supabase.from("events").select("id,org_id,title,event_date").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!event || !projectContext(viewer, event.org_id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  let query = supabase.from("slots").select("id,label,formats(name,sort),versions(number,decision,version_sides(side,optimised_path,reference_path))").eq("event_id", id).eq("requested", true).eq("state", "approved");
  if (slotId) query = query.eq("id", slotId);
  const { data: slots } = await query;

  const files: Record<string, Uint8Array> = {};
  const missing: string[] = [];
  const rows = [...(slots ?? [])].sort((a, b) => ((a.formats as unknown as { sort: number })?.sort ?? 0) - ((b.formats as unknown as { sort: number })?.sort ?? 0));
  const jobs: { path: string; formatName: string; name: string }[] = [];
  for (const slot of rows) {
    const fmt = slot.formats as unknown as { name: string } | null;
    const approved = (slot.versions as { number: number; decision: string; version_sides: { side: string; optimised_path: string | null; reference_path: string | null }[] }[]).find((v) => v.decision === "approved");
    if (!approved) continue;
    for (const side of approved.version_sides.sort((a, b) => (a.side === "front" ? -1 : 1) - (b.side === "front" ? -1 : 1))) {
      const path = side.optimised_path ?? side.reference_path;
      if (!path) { missing.push(fmt?.name ?? "format"); continue; }
      jobs.push({ path, formatName: fmt?.name ?? "format", name: assetFilename({ eventDate: event.event_date, eventTitle: event.title, formatName: slotName(fmt?.name, slot.label as string | null), side: side.side, number: approved.number, path }) });
    }
  }
  // Fetch every file at once; they are added in the order of the formats.
  const fetched = await Promise.all(jobs.map(async (j) => ({ j, file: await readFile(supabase, j.path) })));
  for (const { j, file } of fetched) {
    if (!file) { missing.push(j.formatName); continue; }
    files[j.name] = new Uint8Array(file);
  }
  if (Object.keys(files).length === 0) return NextResponse.json({ error: "Nothing approved to download yet" }, { status: 404 });
  if (missing.length) files["README.txt"] = strToU8(`Not included (files no longer stored): ${[...new Set(missing)].join(", ")}\n`);
  const zip = zipSync(files, { level: 0 }); // images are already compressed; store them as-is
  const one = slotId && rows[0] ? `_${slugify(slotName((rows[0].formats as unknown as { name: string } | null)?.name, rows[0].label as string | null))}` : "";
  const name = `${event.event_date?.slice(0, 4) ?? new Date().getFullYear()}_${slugify(event.title)}${one}_approved.zip`;
  return new Response(new Uint8Array(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
