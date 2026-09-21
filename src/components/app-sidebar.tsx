"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { setCurrentOrg } from "@/app/actions/org";
import { signOut } from "@/app/actions/auth";
import type { Organisation } from "@/lib/types";

const NAV = [
  { href: "/events", label: "Events", icon: "event" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function AppSidebar({ org, orgs, user, slots }: { org: Organisation; orgs: Organisation[]; user: { name: string; role: string; initials: string }; slots: { used: number; max: number } }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="none" className="h-dvh border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-14 w-full items-center gap-3 rounded-xl border border-border bg-card pl-2.5 pr-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-[15px] font-medium text-brand-foreground">{org.short_name[0]}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium leading-5">{org.name}</span><span className="block text-xs text-muted-foreground">Design &amp; Concur</span></span>
            <Icon name="unfold_more" className="shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] rounded-xl p-1.5">
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} className="h-11 rounded-lg px-3 text-[15px]" onSelect={() => setCurrentOrg(o.slug)}>
                <span className="flex size-7 items-center justify-center rounded-md bg-brand text-xs font-medium text-brand-foreground">{o.short_name[0]}</span>{o.name}
                {o.id === org.id && <Icon name="check" className="ml-auto text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarMenu className="gap-1">
          {NAV.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + "/"); return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={active} className="h-11 gap-3 rounded-xl px-3 text-[15px] font-medium text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground">
                <Link href={item.href}><Icon name={item.icon} size={24} fill={active} />{item.label}</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ); })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="gap-5 p-4">
        <div className="space-y-2 px-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Event slots</span><span className="font-medium">{slots.used} / {slots.max}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted-strong"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (slots.used / slots.max) * 100)}%` }} /></div>
          <p className="text-xs text-muted-foreground">Shared by Harisumiran and ACC</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-14 w-full items-center gap-3 rounded-xl px-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
            <UserAvatar initials={user.initials} size={40} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium leading-5">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.role}</span></span>
            <Icon name="more_horiz" className="shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] rounded-xl p-1.5">
            <DropdownMenuItem className="h-11 rounded-lg px-3 text-[15px]" asChild><Link href="/inbox"><Icon name="mail" />Email preferences</Link></DropdownMenuItem>
            <DropdownMenuItem className="h-11 rounded-lg px-3 text-[15px]" onSelect={() => signOut()}><Icon name="logout" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
