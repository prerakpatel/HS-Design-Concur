import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { OrgMark } from "@/components/org-mark";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { setCurrentOrg } from "@/app/actions/org";
import { signOut } from "@/app/actions/auth";
import type { Organisation } from "@/lib/types";

// icons: account_circle chevron_right check settings notifications logout
export interface ProfileUser { name: string; email: string; role: string; initials: string; avatar?: string | null }

/**
 * The "you" screen: who you are, which organisation you are working in, and the doors to Settings, notifications
 * and sign-out. On phones this is the fourth tab and replaces the old top bar; on desktop the sidebar covers the
 * same ground, so the page is just a plain fallback.
 */
export function ProfileView({ user, orgs, currentOrgId }: { user: ProfileUser; orgs: Organisation[]; currentOrgId: string }) {
  const row = "flex h-14 items-center gap-4 px-4 text-sm";
  return (
    <div className="mx-auto max-w-[560px] space-y-8">
      <div className="flex items-center gap-4">
        <UserAvatar initials={user.initials} src={user.avatar} size={40} className="size-16 text-lg" />
        <div className="min-w-0"><p className="truncate text-lg font-semibold leading-6">{user.name}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p><p className="mt-0.5 text-sm text-muted-foreground">{user.role}</p></div>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Working in</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {orgs.map((o) => (
            <li key={o.id}>
              <form action={setCurrentOrg.bind(null, o.slug)}>
                <button type="submit" className={row + " w-full text-left hover:bg-subtle"} aria-pressed={o.id === currentOrgId}>
                  <OrgMark org={o} size={32} /><span className="flex-1 font-medium">{o.name}</span>{o.id === currentOrgId && <Icon name="check" className="text-muted-foreground" />}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {orgs.length > 1 && <p className="mt-2 px-1 text-xs text-muted-foreground">Events, formats and people are per organisation. Switch here to see the other one.</p>}
      </section>

      <section>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          <li><Link href="/settings" className={row + " hover:bg-subtle"}><Icon name="settings" /><span className="flex-1 font-medium">Settings</span><Icon name="chevron_right" className="text-muted-foreground" /></Link></li>
          <li><Link href="/inbox" className={row + " hover:bg-subtle"}><Icon name="notifications" /><span className="flex-1 font-medium">Notifications</span><Icon name="chevron_right" className="text-muted-foreground" /></Link></li>
        </ul>
      </section>

      <form action={signOut}><Button type="submit" variant="outline" size="lg" className="w-full"><Icon name="logout" />Sign out</Button></form>
    </div>
  );
}
