"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";

const TABS = [
  { href: "/events", label: "Events", icon: "event" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
];

const isTaskScreen = (path: string) => /\/events\/[^/]+\/slots\/|\/preview\/slot$/.test(path);

export function MobileNav({ user }: { user: { initials: string; avatar?: string | null } }) {
  const pathname = usePathname();
  if (isTaskScreen(pathname)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => { const active = pathname === t.href || pathname.startsWith(t.href + "/"); return (
          <li key={t.href} className="flex-1">
            <Link href={t.href} className={"flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium " + (active ? "text-foreground" : "text-muted-foreground")}>
              <span className={"flex h-8 w-14 items-center justify-center rounded-full " + (active ? "bg-sidebar-accent" : "")}>
                {t.href === "/profile" ? <UserAvatar initials={user.initials} src={user.avatar} size={24} className={active ? "ring-2 ring-foreground" : ""} /> : <Icon name={t.icon} size={24} fill={active} />}
              </span>{t.label}
            </Link>
          </li>
        ); })}
      </ul>
    </nav>
  );
}
