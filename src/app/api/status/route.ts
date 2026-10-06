import { NextResponse } from "next/server";
import { getMaintenance } from "@/lib/maintenance";

/** Polled by the maintenance veil so an open page learns about a hold without a reload. Public: it reveals nothing private. */
export async function GET() {
  return NextResponse.json(await getMaintenance(), { headers: { "Cache-Control": "no-store" } });
}
