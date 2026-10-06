import { createClient } from "@/lib/supabase/server";

export interface MaintenanceState { on: boolean; message: string | null; since: string | null; admin: boolean }
export const OFF: MaintenanceState = { on: false, message: null, since: null, admin: false };

/**
 * Is the maintenance hold on? `admin` is true for an active Core Admin, who keeps working (and sees a slim banner)
 * while everyone else sees the hold screen. Never throws: if the check itself fails the app stays open.
 */
export async function getMaintenance(): Promise<MaintenanceState> {
  if (process.env.DESIGN_PREVIEW === "1") return OFF;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_settings").select("maintenance,maintenance_message,maintenance_at").eq("id", true).maybeSingle();
    if (!data?.maintenance) return OFF;
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims.sub;
    let admin = false;
    if (uid) { const { data: u } = await supabase.from("users").select("role,status").eq("id", uid).maybeSingle(); admin = u?.role === "core_admin" && u?.status === "active"; }
    return { on: true, message: data.maintenance_message, since: data.maintenance_at, admin };
  } catch { return OFF; }
}
