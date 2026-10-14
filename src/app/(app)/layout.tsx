import { cookies } from "next/headers";
import { capFor } from "@/lib/project";
import { AppShell } from "@/components/app-shell";
import { GuestShell } from "@/components/guest-shell";
import { requireViewer, initials } from "@/lib/auth";
import { remember } from "@/lib/memo";
import { RELEASES, LATEST_RELEASE } from "@/config/changelog";
import { assistantAllowed, ears } from "@/lib/assistant/access";
import { ASSISTANT_NAME, SPEECH_KEYTERMS } from "@/config/assistant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  // A guest (no organization) gets the plain frame; each page below decides whether a guest may open it at all.
  if (!viewer.member) return <GuestShell user={{ name: viewer.user.name ?? viewer.user.email, email: viewer.user.email, initials: initials(viewer.user.name, viewer.user.email), avatar: viewer.user.avatar_url }}>{children}</GuestShell>;
  const { supabase, user, orgs, org, isApprover } = viewer.member;
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  // The sidebar's "project slots" count is per organization and moves slowly: one read a minute per server instance.
  // Which releases were already shared to chat only matters to Core Admins (they get the Share button).
  const withAssistant = assistantAllowed(user);
  const [count, { data: shared }, { data: formats }] = await Promise.all([
    remember(`slots:${org.id}`, 60_000, async () => (await supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active").is("deleted_at", null)).count ?? 0),
    user.role === "core_admin" ? supabase.from("changelog_posts").select("release_id") : Promise.resolve({ data: [] as { release_id: string }[] }),
    withAssistant ? remember("assistant:formats", 60_000, async () => supabase.from("formats").select("key,name").eq("active", true).order("sort")) : Promise.resolve({ data: [] as { key: string; name: string }[] }),
  ]);
  const assistant = withAssistant ? { name: ASSISTANT_NAME, ears: ears(), formats: (formats ?? []) as { key: string; name: string }[], keyterms: [...SPEECH_KEYTERMS, ...((formats ?? []) as { name: string }[]).map((f) => f.name)] } : null;
  const changelog = { releases: RELEASES, unseen: user.changelog_seen !== LATEST_RELEASE.id, canShare: user.role === "core_admin", sharedIds: (shared ?? []).map((r) => r.release_id as string) };
  const role = [user.role === "core_admin" ? "Core Admin" : "Member", isApprover ? "Approver" : null].filter(Boolean).join(" · ");
  return <AppShell org={org} orgs={orgs} user={{ name: user.name ?? user.email, role, initials: initials(user.name, user.email), avatar: user.avatar_url }} slots={{ used: count ?? 0, max: capFor(org) }} sidebarOpen={sidebarOpen} changelog={changelog} assistant={assistant}>{children}</AppShell>;
}
