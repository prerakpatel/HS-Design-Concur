"use client";
// icons: expand_more, check
import { usePathname } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/material-icon";
import { OrgMark } from "@/components/org-mark";
import { setCurrentOrg } from "@/app/actions/org";
import type { Organization } from "@/lib/types";

/** Phones: the organisation switcher on the left (one tap) (the Inbox bell is in the bottom bar). Hidden on task screens, which have their own bar. */
export function MobileTopBar({ org, orgs }: { org: Organization; orgs: Organization[] }) {
  const pathname = usePathname();
  if (/\/events\/[^/]+\/slots\/|\/preview\/slot(-review|-versions)?$/.test(pathname)) return null;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      {orgs.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="-ml-2 flex h-10 items-center gap-2 rounded-full px-2 text-sm font-semibold outline-none hover:bg-muted">
            <OrgMark org={org} size={24} /><span className="truncate">{org.name}</span><Icon name="expand_more" size={20} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] rounded-xl p-1.5">
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} className="h-10 rounded-lg px-3 text-sm" onSelect={() => setCurrentOrg(o.slug)}>
                <OrgMark org={o} size={24} />{o.name}
                {o.id === org.id && <Icon name="check" className="ml-auto text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : <span className="flex items-center gap-2 text-sm font-semibold"><OrgMark org={org} size={24} />{org.name}</span>}
    </header>
  );
}
