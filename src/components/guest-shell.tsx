"use client";
// icons: folder_shared, notifications, logout

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MainFrame } from "@/components/main-frame";
import { UnreadProvider, CountBubble, useUnreadCount } from "@/components/unread-count";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

/**
 * The frame for a guest: someone outside the organizations, added to one or more projects. A top bar with their
 * projects, Inbox and sign-out. No sidebar, org switcher, archive, glossary or settings.
 */
export function GuestShell({ user, children }: { user: { name: string; email: string; initials: string; avatar?: string | null }; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <UnreadProvider>
        <div className="min-h-dvh bg-background">
          <GuestBar user={user} />
          <MainFrame>{children}</MainFrame>
        </div>
      </UnreadProvider>
    </TooltipProvider>
  );
}

function GuestBar({ user }: { user: { name: string; email: string; initials: string; avatar?: string | null } }) {
  const pathname = usePathname();
  const unread = useUnreadCount();
  const tab = (href: string, label: string, icon: string, badge?: number) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={cn("relative flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors", active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
        <Icon name={icon} size={20} fill={active} /><span className="max-sm:sr-only">{label}</span>
        {!!badge && <CountBubble count={badge} className="max-sm:absolute max-sm:right-0.5 max-sm:top-0.5" />}
      </Link>
    );
  };
  return (
    <header className="relative z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-2 px-4 md:px-10">
        <Link href="/shared" className="mr-2 flex min-w-0 items-center gap-2.5">
          <img src="/brand/logo-mark.png" alt="" width={32} height={32} className="size-8 shrink-0" />
          <span className="truncate text-sm font-medium max-sm:hidden">Design &amp; Concur</span>
        </Link>
        <nav className="flex items-center gap-1">
          {tab("/shared", "Your projects", "folder_shared")}
          {tab("/inbox", "Inbox", "notifications", unread)}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account">
            <UserAvatar initials={user.initials} src={user.avatar} size={32} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px] rounded-xl p-1.5">
            <DropdownMenuLabel className="px-3 py-2 font-normal">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email} · Guest</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => signOut()}><Icon name="logout" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
