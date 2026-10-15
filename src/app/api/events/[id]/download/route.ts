import { NextResponse } from "next/server";
import { slotName } from "@/lib/project";
import { strToU8 } from "fflate";
import { zipStream, orderedPrefetch, type ZipEntry } from "@/lib/zip-stream";
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
  if (jobs.length === 0) return NextResponse.json({ error: "Nothing approved to download yet" }, { status: 404 });
  // The ZIP is written while it downloads: a few files are fetched ahead (in the order of the formats), each is
  // added and released, so a big project never has to fit in memory at once.
  const take = orderedPrefetch(jobs, async (j) => { const f = await readFile(supabase, j.path); return f ? new Uint8Array(f.buffer, f.byteOffset, f.length) : null; }, 4);
  let readmeSent = false;
  const next = async (): Promise<ZipEntry | null> => {
    for (let got = await take(); got; got = await take()) {
      if (got.value) return { name: got.item.name, data: got.value };
      missing.push(got.item.formatName);
    }
    if (missing.length && !readmeSent) { readmeSent = true; return { name: "README.txt", data: strToU8(`Not included (files no longer stored): ${[...new Set(missing)].join(", ")}\n`) }; }
    return null;
  };
  const one = slotId && rows[0] ? `_${slugify(slotName((rows[0].formats as unknown as { name: string } | null)?.name, rows[0].label as string | null))}` : "";
  const name = `${event.event_date?.slice(0, 4) ?? new Date().getFullYear()}_${slugify(event.title)}${one}_approved.zip`;
  return new Response(zipStream(next), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
