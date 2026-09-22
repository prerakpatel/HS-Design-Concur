import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requireActiveUser, initials } from "@/lib/auth";
import { EVENT_CAP } from "@/config/limits";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, orgs, org } = await requireActiveUser();
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  const role = [user.role === "core_admin" ? "Core Admin" : "Member", user.is_approver || user.role === "core_admin" ? "Approver" : null].filter(Boolean).join(" · ");
  return <AppShell org={org} orgs={orgs} user={{ name: user.name ?? user.email, role, initials: initials(user.name, user.email) }} slots={{ used: count ?? 0, max: EVENT_CAP }} sidebarOpen={sidebarOpen}>{children}</AppShell>;
}
