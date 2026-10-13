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
    supabase.from("org_memberships").select("org_id,is_approver").eq("user_id", uid),
    // Everything except the webhook URLs: they are secrets, and this object is handed to client components.
    supabase.from("organisations").select("id,slug,name,short_name,accepting_signups,email_enabled,chat_enabled,slack_enabled,logo_path,event_cap,asset_requests").order("name").returns<Omit<Organization, "chat_webhook_url" | "slack_webhook_url">[]>(),
  ]);
  if (!user) return null;
  const memberOrgIds = new Set((memberships ?? []).map((m) => m.org_id));
  // Approving is per organization: the flag sits on the membership, not on the person.
  const approverOrgIds = new Set((memberships ?? []).filter((m) => m.is_approver).map((m) => m.org_id as string));
  const myOrgs: Organization[] = (orgs ?? []).filter((o) => memberOrgIds.has(o.id)).map((o) => ({ ...o, chat_webhook_url: null, slack_webhook_url: null }));
  return { supabase, user, orgs: myOrgs, approverOrgIds };
});

export type ActiveContext = NonNullable<Awaited<ReturnType<typeof getSession>>> & { org: Organization; /** Can this person approve in the organization they are working in? */ isApprover: boolean };

/** Active user with at least one org, or null. Route handlers use this and answer 401 themselves. */
export async function getActiveUser(): Promise<ActiveContext | null> {
  const session = await getSession();
  if (!session || session.user.status !== "active" || session.orgs.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value ?? DEFAULT_ORG;
  const org = session.orgs.find((o) => o.slug === wanted) ?? session.orgs[0];
  return { ...session, org, isApprover: session.approverOrgIds.has(org.id) };
}

/** Active user with at least one org, or redirect (pages and server actions). Guests go to their shared projects. */
export async function requireActiveUser(): Promise<ActiveContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.status !== "active") redirect("/awaiting");
  if (session.orgs.length === 0) redirect("/shared");
  const ctx = await getActiveUser();
  if (!ctx) redirect("/awaiting");
  return ctx;
}

export type Viewer = NonNullable<Awaited<ReturnType<typeof getSession>>> & {
  /** The member context (current organization), or null for a guest: active, in no organization. */
  member: ActiveContext | null;
};

/**
 * Anyone signed in and active: a member, or a guest who only sees the projects whose People list has their email
 * (row-level security decides which). For the few pages a guest may open: their projects, a project, an asset, Inbox.
 */
export async function requireViewer(): Promise<Viewer> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.status !== "active") redirect("/awaiting");
  return { ...session, member: session.orgs.length ? await getActiveUser() : null };
}

/** The same without redirects, for route handlers (they answer 401 themselves). */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getSession();
  if (!session || session.user.status !== "active") return null;
  return { ...session, member: session.orgs.length ? await getActiveUser() : null };
}

/**
 * How this person sees one project: as a member of its organization (approving per that organization), or as a guest.
 * Only call it with an event the person could read, so "not a member" means they are on its People list.
 */
export function projectAccess(viewer: Pick<Viewer, "orgs" | "approverOrgIds">, eventOrgId: string) {
  const org = viewer.orgs.find((o) => o.id === eventOrgId) ?? null;
  return { guest: !org, org, isApprover: !!org && viewer.approverOrgIds.has(org.id) };
}

/**
 * The context for acting on one project (comment, upload, ask for changes): a member of its organization working in
 * that organization, or a guest on its People list. `org` is the project's organization (for a guest, only its id is
 * filled in). Null when a member is working in another organization.
 */
export function projectContext(viewer: Viewer, eventOrgId: string): (ActiveContext & { guest: boolean }) | null {
  const access = projectAccess(viewer, eventOrgId);
  if (!access.guest) return viewer.member && viewer.member.org.id === eventOrgId ? { ...viewer.member, guest: false } : null;
  return { ...viewer, org: { id: eventOrgId } as Organization, isApprover: false, guest: true };
}

export function initials(name: string | null, email: string) {
  const src = (name ?? email.split("@")[0]).trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || src.slice(0, 2).toUpperCase();
}
