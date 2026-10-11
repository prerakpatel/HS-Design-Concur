import { requireActiveUser, initials } from "@/lib/auth";
import { loadGroups, HEARS_LABEL } from "@/lib/groups";
import { PageHeader } from "@/components/page-header";
import { ProfileView } from "@/components/profile-view";
import { LATEST_RELEASE } from "@/config/changelog";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, user, org, orgs, isApprover } = await requireActiveUser();
  // Everyone can see their organization's groups (only Core Admins can change them).
  const groups = await loadGroups(supabase, [org.id]);
  const memberIds = [...new Set(groups.flatMap((g) => g.members))];
  const { data: people } = memberIds.length ? await supabase.from("users").select("id,name,email,avatar_url").in("id", memberIds) : { data: [] as { id: string; name: string | null; email: string; avatar_url: string | null }[] };
  const who = new Map((people ?? []).map((u) => [u.id, { name: u.name ?? u.email, initials: initials(u.name, u.email), avatar: u.avatar_url }]));
  const profileGroups = groups.map((g) => ({ id: g.id, name: g.name, hears: `Hears about: ${HEARS_LABEL[g.hears].label.toLowerCase()}`, mine: g.members.includes(user.id), members: g.members.flatMap((m) => who.get(m) ?? []) })).sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
  // Most significant first; "Member" only when nothing else applies.
  const roles = [user.role === "core_admin" ? "Core Admin" : null, isApprover ? "Approver" : null, ...user.function_tags.map((t) => t[0].toUpperCase() + t.slice(1))].filter((r): r is string => !!r);
  if (roles.length === 0) roles.push("Member");
  return (
    <>
      <PageHeader title="Profile" />
      <ProfileView user={{ name: user.name ?? user.email, email: user.email, roles, initials: initials(user.name, user.email), avatar: user.avatar_url, slackId: user.slack_user_id, gchatLinked: !!user.gchat_user_id, whatsNewUnseen: user.changelog_seen !== LATEST_RELEASE.id }} orgs={orgs} currentOrgId={org.id} groups={profileGroups} />
    </>
  );
}
