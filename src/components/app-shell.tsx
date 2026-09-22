import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav, MobileTopBar } from "@/components/mobile-nav";
import type { Organisation } from "@/lib/types";

export interface ShellProps { org: Organisation; orgs: Organisation[]; user: { name: string; role: string; initials: string }; slots: { used: number; max: number } }

/** Desktop: 272px sidebar + content column. Mobile: top bar with org + bottom tab bar (PRD §12.3). */
export function AppShell({ org, orgs, user, slots, children, wide }: ShellProps & { children: React.ReactNode; wide?: boolean }) {
  return (
    <SidebarProvider>
      <div className="hidden md:contents"><AppSidebar org={org} orgs={orgs} user={user} slots={slots} /></div>
      <SidebarInset className="min-h-dvh bg-background">
        <MobileTopBar org={org} orgs={orgs} initials={user.initials} />
        <main className={wide ? "w-full" : "mx-auto w-full max-w-[1120px] px-5 pb-28 pt-4 md:px-10 md:pb-16 md:pt-8"}>{children}</main>
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
