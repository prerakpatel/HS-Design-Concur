import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser, initials } from "@/lib/auth";
import { decideAccess, updateOrgSettings, sendTestChat, sendTestEmail } from "@/app/actions/admin";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsersList } from "@/components/settings/user-editor";
import { AccessRequests } from "@/components/settings/access-requests";
import { TestButton } from "@/components/settings/test-button";
import { emailConfigured } from "@/lib/email";
import { formatSize } from "@/lib/labels";
import type { AppUser, Format, Organisation } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "users" } = await searchParams;
  const { supabase, user, org } = await requireActiveUser();
  if (user.role !== "core_admin") redirect("/events");
  const [{ data: users }, { data: memberships }, { data: orgs }, { data: formats }, { data: requests }] = await Promise.all([
    supabase.from("users").select("*").order("name").returns<AppUser[]>(),
    supabase.from("org_memberships").select("user_id,org_id"),
    supabase.from("organisations").select("*").order("name").returns<Organisation[]>(),
    supabase.from("formats").select("*").order("sort").returns<Format[]>(),
    supabase.from("access_requests").select("user_id,requested_at").is("decided_at", null),
  ]);
  const orgsOf = new Map<string, string[]>();
  for (const m of memberships ?? []) orgsOf.set(m.user_id, [...(orgsOf.get(m.user_id) ?? []), m.org_id]);
  const askedAt = new Map((requests ?? []).map((r) => [r.user_id, r.requested_at]));
  const pending = (users ?? []).filter((u) => u.status === "pending");
  const active = (users ?? []).filter((u) => u.status === "active");
  const orgOptions = (orgs ?? []).map((o) => ({ id: o.id, label: o.short_name }));
  const tabs: [string, string][] = [["users", "Users"], ["requests", pending.length ? `Requests · ${pending.length}` : "Requests"], ["formats", "Formats"], ["notifications", "Notifications"]];
  return (
    <>
      <PageHeader title="Settings" subtitle="Core Admins only" />
      <nav className="mb-8 flex gap-6 overflow-x-auto border-b border-border text-[15px] font-medium">{tabs.map(([k, l]) => <Link key={k} href={`/settings?tab=${k}`} className={"-mb-px shrink-0 border-b-2 pb-3 " + (tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</Link>)}</nav>

      {tab === "users" && <UsersList currentUserId={user.id} orgs={orgOptions} users={active.map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email, initials: initials(u.name, u.email), role: u.role, is_approver: u.is_approver, function_tags: u.function_tags, orgIds: orgsOf.get(u.id) ?? [] }))} />}

      {tab === "requests" && <AccessRequests action={decideAccess} orgs={orgOptions} defaultOrgId={org.id} pending={pending.map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email, initials: initials(u.name, u.email), requested_at: askedAt.get(u.id) ?? u.created_at }))} />}

      {tab === "formats" && (
        <section>
          <p className="mb-5 max-w-2xl text-[15px] text-muted-foreground">The catalog every event starts from. In-line editing for Designers and Core Admins arrives with the next release.</p>
          <ul className="divide-y divide-border">
            {(formats ?? []).map((f) => <li key={f.id} className="flex items-center gap-4 py-4 text-[15px]"><span className="flex-1 font-medium">{f.name}</span><span className="text-sm text-muted-foreground">{formatSize(f)}</span><StateBadge state="requested" label={f.class} />{!f.active && <StateBadge state="na" label="Inactive" />}</li>)}
          </ul>
        </section>
      )}

      {tab === "notifications" && (
        <div className="space-y-10">
          <section className="grid gap-6 md:grid-cols-2">
            {(orgs ?? []).map((o) => (
              <form key={o.id} action={updateOrgSettings.bind(null, o.id)} className="space-y-5 rounded-2xl border border-border p-6">
                <h2 className="text-xl font-semibold tracking-[-0.01em]">{o.name}</h2>
                <ToggleRow name="accepting_signups" label="Accepting new members" hint="Off hides the request button on the sign-in page." on={o.accepting_signups} />
                <ToggleRow name="email_enabled" label="Email notifications" hint="Each person still picks instant, daily or off." on={o.email_enabled} />
                <ToggleRow name="chat_enabled" label="Google Chat notifications" hint="Sent for review, changes requested, approved, reopened." on={o.chat_enabled} />
                <div className="space-y-2"><Label htmlFor={`hook-${o.id}`}>Google Chat webhook URL</Label><Input id={`hook-${o.id}`} name="chat_webhook_url" defaultValue={o.chat_webhook_url ?? ""} placeholder="https://chat.googleapis.com/v1/spaces/…" /></div>
                <div className="flex flex-wrap gap-2 pt-1"><Button type="submit">Save</Button><TestButton label="Send test message" action={async () => { "use server"; await sendTestChat(o.id); }} /></div>
              </form>
            ))}
          </section>
          <section className="rounded-2xl border border-border p-6">
            <SectionHeader title="Email" />
            <p className="max-w-2xl text-[15px] text-muted-foreground">{emailConfigured() ? `Sending from ${process.env.EMAIL_FROM}. Each person chooses instant, daily digest or off from their Inbox.` : "Not configured yet. Add RESEND_API_KEY and EMAIL_FROM on Vercel (see docs/notifications.md), then redeploy."}</p>
            <div className="mt-4"><TestButton label="Send me a test email" action={async () => { "use server"; await sendTestEmail(); }} /></div>
          </section>
        </div>
      )}
    </>
  );
}

function ToggleRow({ name, label, hint, on }: { name: string; label: string; hint: string; on: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl bg-subtle p-4">
      <span><span className="block text-[15px] font-medium">{label}</span><span className="block text-sm text-muted-foreground">{hint}</span></span>
      <span className="relative"><input type="checkbox" name={name} defaultChecked={on} className="peer sr-only" /><span className="block h-7 w-12 rounded-full bg-muted-strong transition-colors peer-checked:bg-primary" /><span className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" /></span>
    </label>
  );
}
