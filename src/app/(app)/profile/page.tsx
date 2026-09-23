import { requireActiveUser, initials } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ProfileView } from "@/components/profile-view";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, org, orgs } = await requireActiveUser();
  const role = [user.role === "core_admin" ? "Core Admin" : "Member", user.is_approver || user.role === "core_admin" ? "Approver" : null, ...user.function_tags.map((t) => t[0].toUpperCase() + t.slice(1))].filter(Boolean).join(" · ");
  return (
    <>
      <PageHeader title="Profile" />
      <ProfileView user={{ name: user.name ?? user.email, email: user.email, role, initials: initials(user.name, user.email), avatar: user.avatar_url }} orgs={orgs} currentOrgId={org.id} />
    </>
  );
}
