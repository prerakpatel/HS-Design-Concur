"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { OrgMark } from "@/components/org-mark";
import { setCurrentOrg } from "@/app/actions/org";
import type { Organisation } from "@/lib/types";

const TABS = [
  { href: "/events", label: "Events", icon: "event" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => { const active = pathname === t.href || pathname.startsWith(t.href + "/"); return (
          <li key={t.href} className="flex-1">
            <Link href={t.href} className={"flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium " + (active ? "text-foreground" : "text-muted-foreground")}>
              <span className={"flex h-8 w-14 items-center justify-center rounded-full " + (active ? "bg-sidebar-accent" : "")}><Icon name={t.icon} size={24} fill={active} /></span>{t.label}
            </Link>
          </li>
        ); })}
      </ul>
    </nav>
  );
}

export function MobileTopBar({ org, orgs, initials }: { org: Organisation; orgs: Organisation[]; initials: string }) {
  return (
    <header className="flex items-center justify-between px-5 py-3 md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <OrgMark org={org} size={32} />
          {org.name}<Icon name="unfold_more" className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 rounded-xl p-1.5">
          {orgs.map((o) => <DropdownMenuItem key={o.id} className="h-10 rounded-lg px-3 text-sm" onSelect={() => setCurrentOrg(o.slug)}><OrgMark org={o} size={24} />{o.name}{o.id === org.id && <Icon name="check" className="ml-auto text-muted-foreground" />}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <UserAvatar initials={initials} size={32} />
    </header>
  );
}
