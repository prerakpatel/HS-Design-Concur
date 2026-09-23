import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MainFrame } from "@/components/main-frame";
import type { Organisation } from "@/lib/types";

export interface ShellProps { org: Organisation; orgs: Organisation[]; user: { name: string; role: string; initials: string; avatar?: string | null }; slots: { used: number; max: number }; sidebarOpen?: boolean }

/** Desktop: fixed 256px sidebar (collapses to a 64px rail, remembered in a cookie) + content column. Mobile: bottom tab bar with a Profile tab for org switching and account (PRD §12.3). */
export function AppShell({ org, orgs, user, slots, sidebarOpen = true, children, wide }: ShellProps & { children: React.ReactNode; wide?: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
    <SidebarProvider defaultOpen={sidebarOpen} style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <AppSidebar org={org} orgs={orgs} user={user} slots={slots} />
      <SidebarInset className="min-h-dvh bg-background">
        {wide ? <main className="w-full">{children}</main> : <MainFrame>{children}</MainFrame>}
        <MobileNav user={{ initials: user.initials, avatar: user.avatar }} />
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
