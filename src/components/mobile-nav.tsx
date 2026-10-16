"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { CountBubble, useUnreadCount } from "@/components/unread-count";

const TABS = [
  { href: "/events", label: "Projects", icon: "folder" },
  { href: "/archive", label: "Archive", icon: "inventory_2" },
  { href: "/glossary", label: "Glossary", icon: "menu_book" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
];
/** With the assistant in the middle: Inbox earns the place (it carries a count); Archive lives in Projects → Past. */
const TABS_WITH_ASSISTANT = [
  { href: "/events", label: "Projects", icon: "folder" },
  { href: "/inbox", label: "Inbox", icon: "notifications" },
  { href: "/glossary", label: "Glossary", icon: "menu_book" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
];

const isTaskScreen = (path: string) => /\/events\/[^/]+\/slots\/|\/preview\/slot(-review|-versions)?$/.test(path);

/**
 * The phone's bottom bar. With the assistant, the middle column is his (src/components/assistant/dock.tsx): a raised
 * mic in a notch cut out of the bar's top edge, and him peeking over the bar on the right.
 */
export function MobileNav({ user, assistant = false }: { user: { initials: string; avatar?: string | null }; /** Leave the middle for the assistant's button. */ assistant?: boolean }) {
  const pathname = usePathname();
  const unread = useUnreadCount();
  if (isTaskScreen(pathname)) return null;
  const tabs = assistant ? TABS_WITH_ASSISTANT : TABS;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      {/* The bar's surface on its own layer, so the notch can be cut out of it and its edge drawn, without clipping what rises above it. */}
      <div aria-hidden className={"absolute inset-0 overflow-hidden border-t border-border bg-card/95 backdrop-blur" + (assistant ? " dc-nav-notch" : "")}>
        {assistant && <svg className="absolute left-1/2 top-0 -translate-x-1/2" width="120" height="48" viewBox="0 0 120 48"><path d="M 17.19 0 A 8 8 0 0 0 25.15 7.26 A 35 35 0 1 0 94.85 7.26 A 8 8 0 0 0 102.81 0" fill="none" stroke="var(--border)" strokeWidth="2" /></svg>}
      </div>
      {assistant && <div id="dc-nav-peek" className="absolute inset-x-0 top-0" />}
      {/* Spread like a native bar: the outer tabs sit 16px from the sides, the rest spaced evenly between. */}
      <ul className="relative mx-auto flex max-w-md items-stretch justify-between px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2.5">
        {tabs.map((t, i) => { const active = pathname === t.href || pathname.startsWith(t.href + "/"); return (
          <li key={t.href} className={"flex w-10 shrink-0 justify-center" + (assistant && i >= tabs.length / 2 ? " order-2" : "")}>
            <Link href={t.href} className={"flex flex-col items-center gap-1 whitespace-nowrap py-1.5 text-[12px] font-medium " + (active ? "text-foreground" : "text-muted-foreground")}>
              <span className={"relative flex h-8 w-14 items-center justify-center rounded-full " + (active ? "bg-sidebar-accent" : "")}>
                {t.href === "/profile" ? <UserAvatar initials={user.initials} src={user.avatar} size={24} className={active ? "ring-2 ring-foreground" : ""} /> : <Icon name={t.icon} size={24} fill={active} />}
                {t.href === "/inbox" && <CountBubble count={unread} className="absolute -right-1 -top-1 ring-2 ring-card" />}
              </span>{t.label}
            </Link>
          </li>
        ); })}
        {assistant && <li id="dc-nav-assistant" className="order-1 flex w-10 shrink-0 justify-center" />}
      </ul>
    </nav>
  );
}
