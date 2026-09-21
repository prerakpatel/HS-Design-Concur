import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Organisation } from "@/lib/types";
import { DEFAULT_ORG } from "@/config/orgs";

export const ORG_COOKIE = "dc.org";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: user } = await supabase.from("users").select("*").eq("id", authUser.id).single<AppUser>();
  if (!user) return null;
  const { data: memberships } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id);
  const { data: orgs } = await supabase.from("organisations").select("*").order("name").returns<Organisation[]>();
  const memberOrgIds = new Set((memberships ?? []).map((m) => m.org_id));
  const myOrgs = (orgs ?? []).filter((o) => memberOrgIds.has(o.id));
  return { supabase, user, orgs: myOrgs };
});

/** Active user with at least one org, or redirect. */
export async function requireActiveUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.status !== "active" || session.orgs.length === 0) redirect("/awaiting");
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value ?? DEFAULT_ORG;
  const org = session.orgs.find((o) => o.slug === wanted) ?? session.orgs[0];
  return { ...session, org };
}

export function initials(name: string | null, email: string) {
  const src = (name ?? email.split("@")[0]).trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || src.slice(0, 2).toUpperCase();
}
