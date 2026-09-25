"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { LATEST_RELEASE } from "@/config/changelog";
import { postRelease } from "@/lib/changelog";

/** The person has read the latest release; the sidebar sparkle goes quiet on every device. */
export async function markChangelogSeen() {
  const { supabase, user } = await requireActiveUser();
  await supabase.from("users").update({ changelog_seen: LATEST_RELEASE.id }).eq("id", user.id);
  revalidatePath("/", "layout");
}

/** Core Admin: announce a release in the org chats now instead of waiting for the daily job. */
export async function shareRelease(releaseId: string) {
  const { supabase, user } = await requireActiveUser();
  if (user.role !== "core_admin") throw new Error("Only Core Admins can share release notes");
  const r = await postRelease(supabase, releaseId, user.id);
  if (!r.posted) throw new Error(r.reason ?? "Could not share");
  revalidatePath("/", "layout");
}
