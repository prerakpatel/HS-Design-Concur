import { requireActiveUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const { supabase, user } = await requireActiveUser();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  const items = data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" subtitle={`${items.filter((n) => !n.read_at).length} unread`} />
      {items.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Nothing yet. Assignments, mentions, approvals and due-date reminders land here.</p> : (
        <ul className="divide-y divide-border">{items.map((n) => <li key={n.id} className="py-3 text-sm">{n.kind}</li>)}</ul>
      )}
    </div>
  );
}
