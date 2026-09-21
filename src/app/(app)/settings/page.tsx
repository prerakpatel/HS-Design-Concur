import { redirect } from "next/navigation";
import { requireActiveUser, initials } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import type { AppUser, Organisation } from "@/lib/types";

export const metadata = { title: "Settings" };

const TAG_LABEL = { central: "Central", publication: "Publication", designer: "Designer" } as const;

export default async function SettingsPage() {
  const { supabase, user } = await requireActiveUser();
  if (user.role !== "core_admin") redirect("/events");
  const [{ data: users }, { data: memberships }, { data: orgs }] = await Promise.all([
    supabase.from("users").select("*").neq("status", "removed").order("name").returns<AppUser[]>(),
    supabase.from("org_memberships").select("user_id,org_id"),
    supabase.from("organisations").select("*").returns<Organisation[]>(),
  ]);
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.short_name]));
  const orgsOf = new Map<string, string[]>();
  for (const m of memberships ?? []) orgsOf.set(m.user_id, [...(orgsOf.get(m.user_id) ?? []), orgName.get(m.org_id) ?? ""]);
  const pending = (users ?? []).filter((u) => u.status === "pending");
  const active = (users ?? []).filter((u) => u.status === "active");
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Core Admins only" />
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold">Access requests · {pending.length}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">{pending.map((u) => <li key={u.id} className="flex items-center gap-3 p-4"><UserAvatar initials={initials(u.name, u.email)} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{u.name ?? u.email}</p><p className="text-xs text-muted-foreground">{u.email}</p></div><StateBadge state="draft" label="Pending" /></li>)}</ul>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold">Users</h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-xs font-medium text-muted-foreground"><tr><th className="px-4 py-2 text-left">Member</th><th className="px-4 py-2 text-left">Organisations</th><th className="px-4 py-2 text-left">Role</th><th className="px-4 py-2 text-left">Approver</th><th className="px-4 py-2 text-left">Tags</th></tr></thead>
            <tbody className="divide-y divide-border">
              {active.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><UserAvatar initials={initials(u.name, u.email)} /><div><p className="font-medium">{u.name ?? u.email}</p><p className="text-xs text-muted-foreground">{u.email}</p></div></div></td>
                  <td className="px-4 py-3"><div className="flex gap-1">{(orgsOf.get(u.id) ?? []).map((o) => <StateBadge key={o} state="requested" label={o} />)}</div></td>
                  <td className="px-4 py-3">{u.role === "core_admin" ? "Core Admin" : "Member"}</td>
                  <td className="px-4 py-3">{u.is_approver || u.role === "core_admin" ? "Yes" : "No"}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">{u.function_tags.map((t) => <StateBadge key={t} state="in_review" label={TAG_LABEL[t]} />)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
