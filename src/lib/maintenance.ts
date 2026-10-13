import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { remember } from "@/lib/memo";

/** How long a server instance trusts its last answer. Turning the hold on or off shows within this on every instance. */
const MAINTENANCE_MEMO_MS = 30_000;

export interface MaintenanceState { on: boolean; message: string | null; since: string | null; admin: boolean }
export const OFF: MaintenanceState = { on: false, message: null, since: null, admin: false };

/**
 * Is the maintenance hold on? `admin` is true for an active Core Admin, who keeps working (and sees a slim banner)
 * while everyone else sees the hold screen. Never throws: if the check itself fails the app stays open.
 */
export async function getMaintenance(): Promise<MaintenanceState> {
  if (process.env.DESIGN_PREVIEW === "1") return OFF;
  try {
    // The flag is the same for everyone (readable without signing in), so one instance asks at most every 30 seconds.
    const data = await remember("maintenance", MAINTENANCE_MEMO_MS, async () => {
      const anon = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await anon.from("app_settings").select("maintenance,maintenance_message,maintenance_at").eq("id", true).maybeSingle();
      return data as { maintenance: boolean; maintenance_message: string | null; maintenance_at: string | null } | null;
    });
    if (!data?.maintenance) return OFF;
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims.sub;
    let admin = false;
    if (uid) { const { data: u } = await supabase.from("users").select("role,status").eq("id", uid).maybeSingle(); admin = u?.role === "core_admin" && u?.status === "active"; }
    return { on: true, message: data.maintenance_message, since: data.maintenance_at, admin };
  } catch { return OFF; }
}
