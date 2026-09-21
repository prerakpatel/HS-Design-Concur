"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { setCurrentOrg } from "@/app/actions/org";
import type { Organisation } from "@/lib/types";

const NAV = [
  { href: "/events", label: "Events", icon: "event" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function AppSidebar({ org, orgs, user, slots }: {
  org: Organisation; orgs: Organisation[];
  user: { name: string; role: string; initials: string };
  slots: { used: number; max: number };
}) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-card p-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-medium text-brand-foreground">{org.short_name[0]}</span>
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-medium">{org.name}</span>
              <span className="block text-xs text-muted-foreground">Design &amp; Concur</span>
            </span>
            <Icon name="unfold_more" className="text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} onSelect={() => setCurrentOrg(o.slug)}>
                <span className="flex size-6 items-center justify-center rounded-md bg-brand text-xs font-medium text-brand-foreground">{o.short_name[0]}</span>
                {o.name}
                {o.id === org.id && <Icon name="check" className="ml-auto text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarMenu>
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} className="h-9 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                  <Link href={item.href}><Icon name={item.icon} />{item.label}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="gap-4 p-4">
        <div className="space-y-2 px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex justify-between text-xs"><span className="font-medium text-sidebar-foreground">Event slots</span><span className="font-medium">{slots.used} / {slots.max}</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-muted-strong"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (slots.used / slots.max) * 100)}%` }} /></div>
          <p className="text-xs text-muted-foreground">Shared across Harisumiran and ACC</p>
        </div>
        <div className="flex items-center gap-2.5 px-2">
          <UserAvatar initials={user.initials} />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.role}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
