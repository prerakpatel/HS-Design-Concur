"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { OrgMark } from "@/components/org-mark";
import { setCurrentOrg } from "@/app/actions/org";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import type { Organisation } from "@/lib/types";

const NAV = [
  { href: "/events", label: "Events", icon: "event" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Desktop sidebar. Fixed to the viewport; collapses to a 64px icon rail (button at the bottom, the edge, or ⌘/Ctrl+B). */
export function AppSidebar({ org, orgs, user, slots }: { org: Organisation; orgs: Organisation[]; user: { name: string; role: string; initials: string; avatar?: string | null }; slots: { used: number; max: number } }) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger title={collapsed ? `${org.name} · switch organisation` : undefined} className={cn("flex h-12 w-full items-center gap-2.5 rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center hover:bg-sidebar-accent" : "border border-border bg-card pl-2 pr-2.5 hover:bg-muted")}>
            <OrgMark org={org} size={32} />
            {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium leading-5">{org.name}</span><span className="block text-xs text-muted-foreground">Design &amp; Concur</span></span><Icon name="unfold_more" className="shrink-0 text-muted-foreground" /></>}
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
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="gap-1">
          {NAV.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + "/"); return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-10 gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
                <Link href={item.href}><Icon name={item.icon} size={20} fill={active} /><span className="group-data-[collapsible=icon]:hidden">{item.label}</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ); })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <div className="space-y-2 px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Event slots</span><span className="font-medium">{slots.used} / {slots.max}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted-strong"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (slots.used / slots.max) * 100)}%` }} /></div>
          <p className="text-xs text-muted-foreground">Shared by Harisumiran and ACC</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger title={collapsed ? user.name : undefined} className={cn("flex h-12 w-full items-center gap-3 rounded-xl text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center" : "px-2")}>
            <UserAvatar initials={user.initials} src={user.avatar} size={36} />
            {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium leading-5">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.role}</span></span><Icon name="more_horiz" className="shrink-0 text-muted-foreground" /></>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={collapsed ? "right" : "top"} className="w-[240px] rounded-xl p-1.5">
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" asChild><Link href="/inbox"><Icon name="mail" />Email preferences</Link></DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => signOut()}><Icon name="logout" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={`${collapsed ? "Expand" : "Collapse"} · ⌘B`} className={cn("flex h-9 items-center gap-2 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground", collapsed ? "justify-center" : "px-3")}>
          <Icon name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"} />{!collapsed && "Collapse"}
        </button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
