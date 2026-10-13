import { cookies } from "next/headers";
import { capFor } from "@/lib/project";
import { AppShell } from "@/components/app-shell";
import { GuestShell } from "@/components/guest-shell";
import { requireViewer, initials } from "@/lib/auth";
import { RELEASES, LATEST_RELEASE } from "@/config/changelog";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  // A guest (no organization) gets the plain frame; each page below decides whether a guest may open it at all.
  if (!viewer.member) return <GuestShell user={{ name: viewer.user.name ?? viewer.user.email, email: viewer.user.email, initials: initials(viewer.user.name, viewer.user.email), avatar: viewer.user.avatar_url }}>{children}</GuestShell>;
  const { supabase, user, orgs, org, isApprover } = viewer.member;
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const [{ count }, { data: shared }] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null),
    supabase.from("changelog_posts").select("release_id"),
  ]);
  const changelog = { releases: RELEASES, unseen: user.changelog_seen !== LATEST_RELEASE.id, canShare: user.role === "core_admin", sharedIds: (shared ?? []).map((r) => r.release_id as string) };
  const role = [user.role === "core_admin" ? "Core Admin" : "Member", isApprover ? "Approver" : null].filter(Boolean).join(" · ");
  return <AppShell org={org} orgs={orgs} user={{ name: user.name ?? user.email, role, initials: initials(user.name, user.email), avatar: user.avatar_url }} slots={{ used: count ?? 0, max: capFor(org) }} sidebarOpen={sidebarOpen} changelog={changelog}>{children}</AppShell>;
}
