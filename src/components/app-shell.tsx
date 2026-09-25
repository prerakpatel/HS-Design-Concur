import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MainFrame } from "@/components/main-frame";
import { WhatsNewDialog, type ChangelogState } from "@/components/whats-new";
import { Suspense } from "react";
import type { Organization } from "@/lib/types";

export interface ShellProps { org: Organization; orgs: Organization[]; user: { name: string; role: string; initials: string; avatar?: string | null }; slots: { used: number; max: number }; sidebarOpen?: boolean; changelog: ChangelogState }

/** Desktop: fixed 256px sidebar (collapses to a 64px rail, remembered in a cookie) + content column. Mobile: bottom tab bar with a Profile tab for org switching and account (PRD §12.3). */
export function AppShell({ org, orgs, user, slots, sidebarOpen = true, changelog, children, wide }: ShellProps & { children: React.ReactNode; wide?: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
    <SidebarProvider defaultOpen={sidebarOpen} style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <AppSidebar org={org} orgs={orgs} user={user} slots={slots} whatsNewUnseen={changelog.unseen} />
      <Suspense><WhatsNewDialog state={changelog} /></Suspense>
      <SidebarInset className="min-h-dvh bg-background">
        {wide ? <main className="w-full">{children}</main> : <MainFrame>{children}</MainFrame>}
        <MobileNav user={{ initials: user.initials, avatar: user.avatar }} />
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
