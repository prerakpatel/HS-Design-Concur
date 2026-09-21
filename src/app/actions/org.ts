"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ORG_COOKIE } from "@/lib/auth";

export async function setCurrentOrg(slug: string) {
  const store = await cookies();
  store.set(ORG_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
