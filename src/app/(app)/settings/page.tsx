import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser, initials } from "@/lib/auth";
import { decideAccess, updateOrgSettings, sendTestChat, sendTestEmail } from "@/app/actions/admin";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsersList } from "@/components/settings/user-editor";
import { AccessRequests } from "@/components/settings/access-requests";
import { FormatsList } from "@/components/settings/format-editor";
import { OrgMark } from "@/components/org-mark";
import { TestButton } from "@/components/settings/test-button";
import { emailConfigured } from "@/lib/email";
import type { AppUser, Format, Organisation } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, user, org } = await requireActiveUser();
  const isAdmin = user.role === "core_admin";
  const canEditCatalog = isAdmin || user.function_tags.includes("designer");
  if (!canEditCatalog) redirect("/events");
  const { tab: requested = isAdmin ? "users" : "formats" } = await searchParams;
  const tab = isAdmin ? (requested === "notifications" ? "orgs" : requested) : "formats";
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
  const tabs: [string, string][] = isAdmin ? [["users", "Users"], ["requests", pending.length ? `Requests · ${pending.length}` : "Requests"], ["formats", "Formats"], ["orgs", "Organisations"]] : [["formats", "Formats"]];
  return (
    <>
      <PageHeader title="Settings" subtitle={isAdmin ? "People, access, the format catalog and notifications" : "Format catalog · Designers can edit"} />
      <nav className="mb-8 flex gap-6 overflow-x-auto border-b border-border text-sm font-medium">{tabs.map(([k, l]) => <Link key={k} href={`/settings?tab=${k}`} className={"-mb-px shrink-0 border-b-2 pb-3 " + (tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</Link>)}</nav>

      {tab === "users" && <UsersList currentUserId={user.id} orgs={orgOptions} users={active.map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email, initials: initials(u.name, u.email), avatar: u.avatar_url, role: u.role, is_approver: u.is_approver, function_tags: u.function_tags, orgIds: orgsOf.get(u.id) ?? [], email_pref: u.email_pref }))} />}

      {tab === "requests" && <AccessRequests action={decideAccess} orgs={orgOptions} defaultOrgId={org.id} pending={pending.map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email, initials: initials(u.name, u.email), avatar: u.avatar_url, requested_at: askedAt.get(u.id) ?? u.created_at }))} />}

      {tab === "formats" && (
        <FormatsList formats={formats ?? []} />
      )}

      {tab === "orgs" && (
        <div className="space-y-10">
          <section className="grid gap-6 md:grid-cols-2">
            {(orgs ?? []).map((o) => (
              <form key={o.id} action={updateOrgSettings.bind(null, o.id)} className="space-y-5 rounded-2xl border border-border p-5">
                <div className="flex items-center gap-4">
                  <OrgMark org={o} size={48} />
                  <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold tracking-[-0.01em]">{o.name}</h2><p className="text-sm text-muted-foreground">{o.logo_path ? "Logo shown in the sidebar, on phones and on the sign-in page." : "No logo yet. Upload a PNG or SVG, ideally square, under 1 MB."}</p></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`logo-${o.id}`}>Logo</Label>
                  <Input id={`logo-${o.id}`} name="logo" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium" />
                  {o.logo_path && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" name="remove_logo" className="size-4 rounded border-border" />Remove the current logo</label>}
                </div>
                <ToggleRow name="accepting_signups" label="Accepting new members" hint="Off hides the request button on the sign-in page." on={o.accepting_signups} />
                {emailConfigured() && <ToggleRow name="email_enabled" label="Email notifications" hint="Each person still picks instant, daily or off." on={o.email_enabled} />}
                <ToggleRow name="chat_enabled" label="Google Chat notifications" hint="Sent for review, changes requested, approved, reopened." on={o.chat_enabled} />
                <div className="space-y-2"><Label htmlFor={`hook-${o.id}`}>Google Chat webhook URL</Label><Input id={`hook-${o.id}`} name="chat_webhook_url" defaultValue={o.chat_webhook_url ?? ""} placeholder="https://chat.googleapis.com/v1/spaces/…" /></div>
                <ToggleRow name="slack_enabled" label="Slack notifications" hint="Same four moments, posted to a Slack channel." on={o.slack_enabled} />
                <div className="space-y-2"><Label htmlFor={`slack-${o.id}`}>Slack webhook URL</Label><Input id={`slack-${o.id}`} name="slack_webhook_url" defaultValue={o.slack_webhook_url ?? ""} placeholder="https://hooks.slack.com/services/…" /></div>
                <div className="flex flex-wrap gap-2 pt-1"><Button type="submit">Save</Button><TestButton label="Test Google Chat" action={async () => { "use server"; await sendTestChat(o.id, "chat"); }} /><TestButton label="Test Slack" action={async () => { "use server"; await sendTestChat(o.id, "slack"); }} /></div>
              </form>
            ))}
          </section>
          {/* Email is on hold until a sender domain exists (see docs/setup.md). */}
          {emailConfigured() && (
          <section className="rounded-2xl border border-border p-5">
            <SectionHeader title="Email" />
            <p className="max-w-2xl text-sm text-muted-foreground">{emailConfigured() ? `Sending from ${process.env.EMAIL_FROM}. Each person chooses instant, daily digest or off from their Inbox.` : "Not configured yet. Add RESEND_API_KEY and EMAIL_FROM on Vercel (see docs/notifications.md), then redeploy."}</p>
            <div className="mt-4"><TestButton label="Send me a test email" action={async () => { "use server"; await sendTestEmail(); }} /></div>
          </section>
          )}
        </div>
      )}
    </>
  );
}

function ToggleRow({ name, label, hint, on }: { name: string; label: string; hint: string; on: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl bg-subtle p-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="block text-sm text-muted-foreground">{hint}</span></span>
      <span className="relative"><input type="checkbox" name={name} defaultChecked={on} className="peer sr-only" /><span className="block h-7 w-12 rounded-full bg-muted-strong transition-colors peer-checked:bg-primary" /><span className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" /></span>
    </label>
  );
}
