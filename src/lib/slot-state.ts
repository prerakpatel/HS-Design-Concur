import type { SupabaseClient } from "@supabase/supabase-js";
import type { SlotState } from "@/lib/types";

/**
 * A slot's state follows its newest *sent* version: none → Requested, approved → Approved, changes requested →
 * Changes requested, otherwise In review. Unsent uploads never move the slot (PRD §6.2).
 */
export async function recomputeSlotState(supabase: SupabaseClient, slotId: string): Promise<SlotState> {
  const { data: latest } = await supabase.from("versions").select("id,decision").eq("slot_id", slotId).not("sent_at", "is", null).order("number", { ascending: false }).limit(1).maybeSingle();
  const state: SlotState = !latest ? "requested" : latest.decision === "approved" ? "approved" : latest.decision === "changes_requested" ? "changes_requested" : "in_review";
  if (latest?.decision === "superseded") await supabase.from("versions").update({ decision: "pending" }).eq("id", latest.id);
  await supabase.from("slots").update({ state, updated_at: new Date().toISOString() }).eq("id", slotId);
  return state;
}
