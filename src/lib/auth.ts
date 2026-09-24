import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Organization } from "@/lib/types";
import { DEFAULT_ORG } from "@/config/orgs";

export const ORG_COOKIE = "dc.org";

/**
 * Session for the current request. The token is verified locally (getClaims, cached signing keys), then the
 * user row, memberships and organizations load in parallel: one round of latency instead of four.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) return null;
  const [{ data: user }, { data: memberships }, { data: orgs }] = await Promise.all([
    supabase.from("users").select("*").eq("id", uid).single<AppUser>(),
    supabase.from("org_memberships").select("org_id").eq("user_id", uid),
    supabase.from("organisations").select("*").order("name").returns<Organization[]>(),
  ]);
  if (!user) return null;
  const memberOrgIds = new Set((memberships ?? []).map((m) => m.org_id));
  const myOrgs = (orgs ?? []).filter((o) => memberOrgIds.has(o.id));
  return { supabase, user, orgs: myOrgs };
});

export type ActiveContext = NonNullable<Awaited<ReturnType<typeof getSession>>> & { org: Organization };

/** Active user with at least one org, or null. Route handlers use this and answer 401 themselves. */
export async function getActiveUser(): Promise<ActiveContext | null> {
  const session = await getSession();
  if (!session || session.user.status !== "active" || session.orgs.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value ?? DEFAULT_ORG;
  const org = session.orgs.find((o) => o.slug === wanted) ?? session.orgs[0];
  return { ...session, org };
}

/** Active user with at least one org, or redirect (pages and server actions). */
export async function requireActiveUser(): Promise<ActiveContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.status !== "active" || session.orgs.length === 0) redirect("/awaiting");
  const ctx = await getActiveUser();
  if (!ctx) redirect("/awaiting");
  return ctx;
}

export function initials(name: string | null, email: string) {
  const src = (name ?? email.split("@")[0]).trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || src.slice(0, 2).toUpperCase();
}
