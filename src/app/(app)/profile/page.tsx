import { requireActiveUser, initials } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ProfileView } from "@/components/profile-view";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, org, orgs } = await requireActiveUser();
  // Most significant first; "Member" only when nothing else applies.
  const roles = [user.role === "core_admin" ? "Core Admin" : null, user.is_approver || user.role === "core_admin" ? "Approver" : null, ...user.function_tags.map((t) => t[0].toUpperCase() + t.slice(1))].filter((r): r is string => !!r);
  if (roles.length === 0) roles.push("Member");
  return (
    <>
      <PageHeader title="Profile" />
      <ProfileView user={{ name: user.name ?? user.email, email: user.email, roles, initials: initials(user.name, user.email), avatar: user.avatar_url, slackId: user.slack_user_id, gchatLinked: !!user.gchat_user_id }} orgs={orgs} currentOrgId={org.id} />
    </>
  );
}
