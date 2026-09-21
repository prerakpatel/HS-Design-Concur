"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

export async function updateEmailPref(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const pref = String(formData.get("email_pref"));
  if (!["instant", "digest", "off"].includes(pref)) throw new Error("Unknown preference");
  await supabase.from("users").update({ email_pref: pref }).eq("id", user.id);
  revalidatePath("/inbox");
}
