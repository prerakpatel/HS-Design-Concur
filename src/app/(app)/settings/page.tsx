import { redirect } from "next/navigation";
import { requireActiveUser, initials } from "@/lib/auth";
import { decideAccess, updateUser, removeUser, updateOrgSettings, sendTestChat, sendTestEmail } from "@/app/actions/admin";
import { TestButton } from "@/components/settings/test-button";
import { emailConfigured } from "@/lib/email";
import { PageHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import type { AppUser, Format, Organisation } from "@/lib/types";
import { formatSize } from "@/lib/labels";

export const metadata = { title: "Settings" };
const TAGS: { key: "central" | "publication" | "designer"; label: string }[] = [{ key: "central", label: "Central" }, { key: "publication", label: "Publication" }, { key: "designer", label: "Designer" }];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "users" } = await searchParams;
  const { supabase, user } = await requireActiveUser();
  if (user.role !== "core_admin") redirect("/events");
  const [{ data: users }, { data: memberships }, { data: orgs }, { data: formats }] = await Promise.all([
    supabase.from("users").select("*").order("name").returns<AppUser[]>(),
    supabase.from("org_memberships").select("user_id,org_id"),
    supabase.from("organisations").select("*").order("name").returns<Organisation[]>(),
    supabase.from("formats").select("*").order("sort").returns<Format[]>(),
  ]);
  const orgsOf = new Map<string, Set<string>>();
  for (const m of memberships ?? []) orgsOf.set(m.user_id, new Set([...(orgsOf.get(m.user_id) ?? []), m.org_id]));
  const pending = (users ?? []).filter((u) => u.status === "pending");
  const active = (users ?? []).filter((u) => u.status === "active");
  const tabs = [["requests", `Access requests${pending.length ? ` · ${pending.length}` : ""}`], ["users", "Users"], ["formats", "Formats"], ["notifications", "Notifications"]];
  const check = "size-4 rounded border-input accent-primary";
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Core Admins only" />
      <nav className="flex gap-6 border-b border-border text-sm font-medium">{tabs.map(([k, l]) => <a key={k} href={`/settings?tab=${k}`} className={"-mb-px border-b-2 pb-3 " + (tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</a>)}</nav>

      {tab === "requests" && (
        <section className="space-y-3">
          {pending.length === 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No one is waiting. New sign-ins appear here.</p>}
          {pending.map((u) => (
            <form key={u.id} action={decideAccess.bind(null, u.id)} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border p-4">
              <UserAvatar initials={initials(u.name, u.email)} size={40} />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{u.name ?? u.email}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
              <fieldset className="flex items-center gap-3 text-sm">{(orgs ?? []).map((o) => <label key={o.id} className="flex items-center gap-1.5"><input type="checkbox" name="org" value={o.id} defaultChecked={o.slug === "harisumiran"} className={check} />{o.short_name}</label>)}</fieldset>
              <div className="flex gap-2"><Button type="submit" name="decision" value="deny" variant="ghost">Deny</Button><Button type="submit" name="decision" value="approve">Approve</Button></div>
            </form>
          ))}
        </section>
      )}

      {tab === "users" && (
        <section className="overflow-hidden rounded-2xl border border-border">
          <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.6fr_1.2fr_auto] gap-4 bg-subtle px-4 py-2 text-xs font-medium text-muted-foreground md:grid"><span>Member</span><span>Organisations</span><span>Role</span><span>Approver</span><span>Tags</span><span /></div>
          <ul className="divide-y divide-border">
            {active.map((u) => (
              <li key={u.id}>
                <form action={updateUser.bind(null, u.id)} className="grid grid-cols-1 items-center gap-3 px-4 py-3 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.6fr_1.2fr_auto] md:gap-4">
                  <div className="flex items-center gap-2"><UserAvatar initials={initials(u.name, u.email)} /><div className="min-w-0"><p className="truncate font-medium">{u.name ?? u.email}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div></div>
                  <div className="flex gap-3">{(orgs ?? []).map((o) => <label key={o.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="org" value={o.id} defaultChecked={orgsOf.get(u.id)?.has(o.id)} className={check} />{o.short_name}</label>)}</div>
                  <select name="role" defaultValue={u.role} className="h-8 rounded-lg border border-input bg-card px-2 text-xs"><option value="member">Member</option><option value="core_admin">Core Admin</option></select>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="is_approver" defaultChecked={u.is_approver || u.role === "core_admin"} disabled={u.role === "core_admin"} className={check} />{u.role === "core_admin" ? "Always" : "Can approve"}</label>
                  <div className="flex flex-wrap gap-2">{TAGS.map((t) => <label key={t.key} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="tag" value={t.key} defaultChecked={u.function_tags.includes(t.key)} className={check} />{t.label}</label>)}</div>
                  <div className="flex items-center gap-1"><Button type="submit" size="sm" variant="secondary">Save</Button>{u.id !== user.id && <ConfirmButton size="sm" variant="ghost" label="Remove" title={`Remove ${u.name ?? u.email}?`} description="They lose access immediately. Their comments and uploads stay." confirmLabel="Remove" action={async () => { "use server"; await removeUser(u.id); }} />}</div>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "formats" && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">The catalog every event starts from. Designers and Core Admins can edit rows in-line (editing arrives with the next release; values below are read-only for now).</p>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {(formats ?? []).map((f) => <li key={f.id} className="flex items-center gap-4 px-4 py-3 text-sm"><span className="flex-1 font-medium">{f.name}</span><span className="text-muted-foreground">{formatSize(f)}</span><StateBadge state="requested" label={f.class} />{(f.safe_top || f.safe_bottom) ? <span className="text-xs text-muted-foreground">safe {f.safe_top}/{f.safe_bottom}</span> : null}{!f.active && <StateBadge state="na" label="Inactive" />}</li>)}
          </ul>
        </section>
      )}

      {tab === "notifications" && (
        <section className="grid gap-4 md:grid-cols-2">
          {(orgs ?? []).map((o) => (
            <form key={o.id} action={updateOrgSettings.bind(null, o.id)} className="space-y-4 rounded-2xl border border-border p-5">
              <h2 className="text-[17px] font-semibold">{o.name}</h2>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="accepting_signups" defaultChecked={o.accepting_signups} className={check} />Accepting new members</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email_enabled" defaultChecked={o.email_enabled} className={check} />Email notifications</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="chat_enabled" defaultChecked={o.chat_enabled} className={check} />Google Chat notifications</label>
              <div className="space-y-1.5"><label className="text-xs font-medium" htmlFor={`hook-${o.id}`}>Google Chat webhook URL</label><Input id={`hook-${o.id}`} name="chat_webhook_url" defaultValue={o.chat_webhook_url ?? ""} placeholder="https://chat.googleapis.com/v1/spaces/…" /></div>
              <div className="flex flex-wrap gap-2"><Button type="submit" variant="secondary">Save</Button><TestButton label="Send test message" action={async () => { "use server"; await sendTestChat(o.id); }} /></div>
            </form>
          ))}
          <div className="space-y-3 rounded-2xl border border-border p-5 md:col-span-2">
            <h2 className="text-[17px] font-semibold">Email</h2>
            <p className="text-sm text-muted-foreground">{emailConfigured() ? `Sending from ${process.env.EMAIL_FROM}. Each person picks instant, daily digest or off from their Inbox.` : "Not configured yet. Add RESEND_API_KEY and EMAIL_FROM on Vercel (see docs/notifications.md), then redeploy."}</p>
            <TestButton label="Send me a test email" action={async () => { "use server"; await sendTestEmail(); }} />
          </div>
        </section>
      )}
    </div>
  );
}
