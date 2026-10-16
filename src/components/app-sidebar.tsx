"use client";
// icons: menu

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/material-icon";
import { CountBubble, useUnreadCount } from "@/components/unread-count";
import { UserAvatar } from "@/components/user-avatar";
import { InfoTip } from "@/components/info-tip";
import { OrgMark } from "@/components/org-mark";
import { setCurrentOrg } from "@/app/actions/org";
import { WhatsNewButton } from "@/components/whats-new";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { ASSISTANT_ART } from "@/config/assistant";
import type { Organization } from "@/lib/types";

const NAV = [
  { href: "/events", label: "Projects", icon: "folder" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/glossary", label: "Glossary", icon: "menu_book" },
];

/** Desktop sidebar. Fixed to the viewport; collapses to a 64px icon rail (button at the bottom, the edge, or ⌘/Ctrl+B). */
export function AppSidebar({ org, orgs, user, slots, whatsNewUnseen, assistant = false }: { org: Organization; orgs: Organization[]; user: { name: string; role: string; initials: string; avatar?: string | null }; slots: { used: number; max: number }; whatsNewUnseen: boolean; /** A Vichar row for the people who have him (src/components/assistant/assistant.tsx). */ assistant?: boolean }) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const unread = useUnreadCount();
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={cn("p-3", collapsed ? "flex-col items-center gap-2" : "flex-row items-center gap-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger title={collapsed ? `${org.name} · switch organization` : undefined} className={cn("flex h-12 min-w-0 items-center gap-2.5 rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "" : "flex-1", collapsed ? "justify-center hover:bg-sidebar-accent" : "border border-border bg-card pl-2 pr-2.5 hover:bg-muted")}>
            <OrgMark org={org} size={32} />
            {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium leading-5">{org.name}</span><span className="block truncate text-xs text-muted-foreground">Design &amp; Concur</span></span><Icon name="unfold_more" className="shrink-0 text-muted-foreground" /></>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-[240px] rounded-xl p-1.5">
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} className="h-10 rounded-lg px-3 text-sm" onSelect={() => setCurrentOrg(o.slug)}>
                <OrgMark org={o} size={24} />{o.name}
                {o.id === org.id && <Icon name="check" className="ml-auto text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Collapse / expand: a hamburger right of the org switcher; collapsed, it sits on top of the org mark. The edge rail does the same. */}
        <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", collapsed && "order-first")}>
          <Icon name="menu" size={20} />
        </button>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="gap-1">
          {NAV.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + "/"); return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="relative h-10 gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
                <Link href={item.href}><Icon name={item.icon} size={20} fill={active} /><span className="group-data-[collapsible=icon]:hidden">{item.label}</span>{item.href === "/inbox" && <CountBubble count={unread} className="ml-auto group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:ring-2 group-data-[collapsible=icon]:ring-sidebar" />}</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ); })}
          {assistant && (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Vichar (⌘J)" onClick={() => window.dispatchEvent(new CustomEvent("dc:vichar"))} className="relative h-10 gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
                <span className="relative block size-5 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border" aria-hidden><img src={ASSISTANT_ART.still} alt="" className="absolute left-1/2 top-0 w-[164%] max-w-none -translate-x-1/2" draggable={false} /></span>
                <span className="group-data-[collapsible=icon]:hidden">Vichar</span>
                <kbd className="ml-auto rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">⌘J</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <div className={cn("flex", collapsed && "justify-center")}><WhatsNewButton unseen={whatsNewUnseen} collapsed={collapsed} /></div>
        <div className="space-y-2 px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1 text-muted-foreground">Project slots<InfoTip text="Events and asset requests live at once for this organization. Drafts don't count; an event frees its slot a week after its date, a request at its end date." label="About event slots" /></span><span className="font-medium">{slots.used} / {slots.max}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted-strong"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (slots.used / slots.max) * 100)}%` }} /></div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger title={collapsed ? user.name : undefined} className={cn("flex h-12 w-full items-center gap-3 rounded-xl text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center" : "px-2")}>
            <UserAvatar initials={user.initials} src={user.avatar} size={36} />
            {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium leading-5">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.role}</span></span><Icon name="more_vert" className="shrink-0 text-muted-foreground" /></>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={collapsed ? "right" : "top"} className="w-[240px] rounded-xl p-1.5">
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" asChild><Link href="/profile"><Icon name="account_circle" />Profile</Link></DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" asChild><Link href="/settings"><Icon name="settings" />Settings</Link></DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" asChild><Link href="/inbox"><Icon name="notifications" />Notifications</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => signOut()}><Icon name="logout" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
