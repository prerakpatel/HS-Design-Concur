"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

export async function markAllRead() {
  const { supabase, user } = await requireActiveUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/inbox");
}
