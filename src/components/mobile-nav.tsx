"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";

const TABS = [
  { href: "/events", label: "Projects", icon: "folder" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/glossary", label: "Glossary", icon: "menu_book" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
];

const isTaskScreen = (path: string) => /\/events\/[^/]+\/slots\/|\/preview\/slot(-review|-versions)?$/.test(path);

export function MobileNav({ user, assistant = false }: { user: { initials: string; avatar?: string | null }; /** Leave the middle for the assistant's button (src/components/assistant/dock.tsx). */ assistant?: boolean }) {
  const pathname = usePathname();
  if (isTaskScreen(pathname)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[max(env(safe-area-inset-bottom),12px)] pt-2.5 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-4">
        {TABS.map((t, i) => { const active = pathname === t.href || pathname.startsWith(t.href + "/"); return (
          <li key={t.href} className={"flex-1" + (assistant && i >= TABS.length / 2 ? " order-2" : "")}>
            <Link href={t.href} className={"flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium " + (active ? "text-foreground" : "text-muted-foreground")}>
              <span className={"relative flex h-8 w-14 items-center justify-center rounded-full " + (active ? "bg-sidebar-accent" : "")}>
                {t.href === "/profile" ? <UserAvatar initials={user.initials} src={user.avatar} size={24} className={active ? "ring-2 ring-foreground" : ""} /> : <Icon name={t.icon} size={24} fill={active} />}
              </span>{t.label}
            </Link>
          </li>
        ); })}
        {assistant && <li className="order-1 flex flex-1 items-start justify-center"><div id="dc-nav-assistant" className="flex h-11 w-16 items-center justify-center" /></li>}
      </ul>
    </nav>
  );
}
