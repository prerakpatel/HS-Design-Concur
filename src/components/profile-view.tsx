import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { OrgMark } from "@/components/org-mark";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { setCurrentOrg } from "@/app/actions/org";
import { signOut } from "@/app/actions/auth";
import type { Organization } from "@/lib/types";
import { RoleChips } from "@/components/role-chips";
import { ChatHandles } from "@/components/chat-handles";
import { WhatsNewButton } from "@/components/whats-new";

// icons: account_circle chevron_right check settings notifications logout
export interface ProfileGroup { id: string; name: string; hears: string; mine: boolean; members: { name: string; initials: string; avatar?: string | null }[] }
export interface ProfileUser { name: string; email: string; roles: string[]; initials: string; avatar?: string | null; slackId: string | null; gchatLinked: boolean; whatsNewUnseen?: boolean }

/**
 * The "you" screen: who you are, which organization you are working in, and the doors to Settings, notifications
 * and sign-out. On phones this is the fourth tab and replaces the old top bar; on desktop the sidebar covers the
 * same ground, so the page is just a plain fallback.
 */
export function ProfileView({ user, orgs, currentOrgId, groups = [] }: { user: ProfileUser; orgs: Organization[]; currentOrgId: string; groups?: ProfileGroup[] }) {
  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const row = "flex h-14 items-center gap-4 px-4 text-sm";
  return (
    <div className="mx-auto max-w-[560px] space-y-8">
      <div className="flex items-center gap-4">
        <UserAvatar initials={user.initials} src={user.avatar} size={40} className="size-16 text-lg" />
        <div className="min-w-0"><p className="truncate text-lg font-semibold leading-6">{user.name}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p><RoleChips roles={user.roles} className="mt-1.5" /></div>
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
        {orgs.length > 1 && <p className="mt-2 px-1 text-xs text-muted-foreground">Events, formats and people are per organization. Switch here to see the other one.</p>}
      </section>

      {groups.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Groups in {currentOrg?.short_name ?? "this organization"}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {groups.map((g) => (
              <li key={g.id} className="space-y-2.5 px-4 py-3.5">
                <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</p>{g.mine && <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info-text">You’re in</span>}</div>
                <p className="text-[13px] text-muted-foreground">{g.hears}</p>
                <ul className="flex flex-wrap gap-1.5">{g.members.map((m) => <li key={m.name} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted pl-1 pr-2.5 text-[13px]"><UserAvatar initials={m.initials} src={m.avatar} size={24} className="scale-[.83]" />{m.name}</li>)}</ul>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-xs text-muted-foreground">Groups decide which chat channels posts go to. Core Admins manage them in Settings.</p>
        </section>
      )}

      <ChatHandles slackId={user.slackId} gchatLinked={user.gchatLinked} orgName={currentOrg?.short_name ?? "the team"} />

      <section>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          <li><Link href="/settings" className={row + " hover:bg-subtle"}><Icon name="settings" /><span className="flex-1 font-medium">Settings</span><Icon name="chevron_right" className="text-muted-foreground" /></Link></li>
          <li><Link href="/inbox" className={row + " hover:bg-subtle"}><Icon name="notifications" /><span className="flex-1 font-medium">Notifications</span><Icon name="chevron_right" className="text-muted-foreground" /></Link></li>
          <li><WhatsNewButton variant="row" unseen={!!user.whatsNewUnseen} /></li>
        </ul>
      </section>

      <form action={signOut}><Button type="submit" variant="outline" size="lg" className="w-full"><Icon name="logout" />Sign out</Button></form>
    </div>
  );
}
