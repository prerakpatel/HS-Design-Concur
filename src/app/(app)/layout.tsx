import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requireActiveUser, initials } from "@/lib/auth";
import { EVENT_CAP } from "@/config/limits";
import { RELEASES, LATEST_RELEASE } from "@/config/changelog";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, orgs, org } = await requireActiveUser();
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const [{ count }, { data: shared }] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
    supabase.from("changelog_posts").select("release_id"),
  ]);
  const changelog = { releases: RELEASES, unseen: user.changelog_seen !== LATEST_RELEASE.id, canShare: user.role === "core_admin", sharedIds: (shared ?? []).map((r) => r.release_id as string) };
  const role = [user.role === "core_admin" ? "Core Admin" : "Member", user.is_approver || user.role === "core_admin" ? "Approver" : null].filter(Boolean).join(" · ");
  return <AppShell org={org} orgs={orgs} user={{ name: user.name ?? user.email, role, initials: initials(user.name, user.email), avatar: user.avatar_url }} slots={{ used: count ?? 0, max: EVENT_CAP }} sidebarOpen={sidebarOpen} changelog={changelog}>{children}</AppShell>;
}
