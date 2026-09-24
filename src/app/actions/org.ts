"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ORG_COOKIE } from "@/lib/auth";

export async function setCurrentOrg(slug: string) {
  const store = await cookies();
  store.set(ORG_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  // Land on Events in the new organization: a fresh navigation, so nothing from the old one lingers on screen.
  redirect("/events");
}
