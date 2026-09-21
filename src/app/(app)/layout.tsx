import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { requireActiveUser, initials } from "@/lib/auth";
import { EVENT_CAP } from "@/config/limits";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, orgs, org } = await requireActiveUser();
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null);
  const role = [user.role === "core_admin" ? "Core Admin" : "Member", user.is_approver || user.role === "core_admin" ? "Approver" : null].filter(Boolean).join(" · ");
  return (
    <SidebarProvider>
      <AppSidebar org={org} orgs={orgs} user={{ name: user.name ?? user.email, role, initials: initials(user.name, user.email) }} slots={{ used: count ?? 0, max: EVENT_CAP }} />
      <SidebarInset>
        <div className="flex items-center gap-2 p-2 md:hidden"><SidebarTrigger /><span className="text-sm font-medium">{org.name}</span></div>
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-12 md:py-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
