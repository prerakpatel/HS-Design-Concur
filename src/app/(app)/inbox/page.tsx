import Link from "next/link";
import { requireActiveUser } from "@/lib/auth";
import { markAllRead } from "@/app/actions/inbox";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { notificationText, notificationHref, relativeTime } from "@/lib/labels";

export const metadata = { title: "Inbox" };
const ICONS: Record<string, string> = { "access.approved": "how_to_reg", "slot.assigned": "assignment_ind", "event.published": "campaign", "version.uploaded": "upload", "version.changes_requested": "rule", "version.approved": "check_circle", "version.reopened": "replay", "comment.mention": "alternate_email", "event.deleted": "delete" };

export default async function InboxPage() {
  const { supabase, user } = await requireActiveUser();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
  const items = data ?? []; const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" subtitle={unread ? `${unread} unread` : "All caught up"} actions={unread ? <form action={markAllRead}><Button variant="ghost" type="submit">Mark all read</Button></form> : null} />
      {items.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Nothing yet. Assignments, mentions, approvals and due-date reminders land here.</p> : (
        <ul className="divide-y divide-border">
          {items.map((n) => { const p = n.payload as Record<string, unknown>; return (
            <li key={n.id}><Link href={notificationHref(p)} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-subtle">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name={ICONS[n.kind] ?? "notifications"} /></span>
              <span className="min-w-0 flex-1"><span className={"block truncate text-sm " + (n.read_at ? "" : "font-medium")}>{notificationText(n.kind, p)}</span><span className="block text-xs text-muted-foreground">{p.title ? `${p.title} · ` : ""}{relativeTime(n.created_at)}</span></span>
              {!n.read_at && <span className="size-2 rounded-full bg-brand" />}
            </Link></li>
          ); })}
        </ul>
      )}
    </div>
  );
}
