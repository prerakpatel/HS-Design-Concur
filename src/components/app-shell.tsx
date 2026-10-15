import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { MainFrame } from "@/components/main-frame";
import { UnreadProvider } from "@/components/unread-count";
import { AppBadge } from "@/components/app-badge";
import { PushPrompt } from "@/components/push-prompt";
import { InstallNudge } from "@/components/install-nudge";
import { WhatsNewDialog, type ChangelogState } from "@/components/whats-new";
import { Suspense } from "react";
import type { Organization } from "@/lib/types";
import { AssistantMount } from "@/components/assistant/assistant-mount";
import type { AssistantProps } from "@/components/assistant/assistant";

export interface ShellProps { org: Organization; orgs: Organization[]; user: { name: string; role: string; initials: string; avatar?: string | null }; slots: { used: number; max: number }; sidebarOpen?: boolean; changelog: ChangelogState; /** The assistant, for people it is switched on for. */ assistant?: AssistantProps | null }

/** Desktop: fixed 256px sidebar (collapses to a 64px rail, remembered in a cookie) + content column. Mobile: bottom tab bar with a Profile tab for org switching and account (PRD §12.3). */
export function AppShell({ org, orgs, user, slots, sidebarOpen = true, changelog, assistant, children, wide }: ShellProps & { children: React.ReactNode; wide?: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
    <UnreadProvider>
    <SidebarProvider defaultOpen={sidebarOpen} style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <AppBadge />
      <PushPrompt />
      <InstallNudge />
      {assistant && <AssistantMount {...assistant} />}
      <AppSidebar org={org} orgs={orgs} user={user} slots={slots} whatsNewUnseen={changelog.unseen} />
      <Suspense><WhatsNewDialog state={changelog} /></Suspense>
      <SidebarInset className="min-h-dvh min-w-0 bg-background">
        <MobileTopBar org={org} orgs={orgs} />
        {wide ? <main className="w-full">{children}</main> : <MainFrame>{children}</MainFrame>}
        <MobileNav user={{ initials: user.initials, avatar: user.avatar }} assistant={!!assistant} />
      </SidebarInset>
    </SidebarProvider>
    </UnreadProvider>
    </TooltipProvider>
  );
}
