import Link from "next/link";
import { requireActiveUser } from "@/lib/auth";
import { markAllRead } from "@/app/actions/inbox";
import { updateEmailPref } from "@/app/actions/prefs";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { SelectField } from "@/components/ui/select-field";
import { notificationText, notificationHref, relativeTime } from "@/lib/labels";

export const metadata = { title: "Inbox" };
const ICONS: Record<string, string> = { "access.approved": "how_to_reg", "slot.assigned": "assignment_ind", "slot.due": "schedule", "event.published": "campaign", "version.uploaded": "upload", "version.changes_requested": "rule", "version.approved": "check_circle", "version.reopened": "replay", "comment.mention": "alternate_email", "event.deleted": "delete" };

export default async function InboxPage() {
  const { supabase, user } = await requireActiveUser();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
  const items = data ?? []; const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader title="Inbox" subtitle={unread ? `${unread} unread` : "All caught up"} actions={unread ? <form action={markAllRead}><Button variant="secondary" type="submit">Mark all read</Button></form> : null} />
      <form action={updateEmailPref} className="mb-8 flex flex-col gap-3 rounded-2xl bg-subtle p-5 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1"><p className="text-[15px] font-medium">Email me</p><p className="text-sm text-muted-foreground">Approvals, mentions, assignments and due dates. Everything always shows here too.</p></div>
        <div className="flex gap-2"><SelectField name="email_pref" defaultValue={user.email_pref} className="w-52"><option value="instant">as things happen</option><option value="digest">once a day</option><option value="off">never</option></SelectField><Button type="submit" variant="secondary" size="lg">Save</Button></div>
      </form>
      {items.length === 0 ? <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-[15px] text-muted-foreground">Nothing yet. Assignments, mentions, approvals and due-date reminders land here.</p> : (
        <ul className="divide-y divide-border">
          {items.map((n) => { const p = n.payload as Record<string, unknown>; return (
            <li key={n.id}><Link href={notificationHref(p)} className="-mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 hover:bg-subtle">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name={ICONS[n.kind] ?? "notifications"} size={24} /></span>
              <span className="min-w-0 flex-1"><span className={"block text-[15px] leading-6 " + (n.read_at ? "" : "font-medium")}>{notificationText(n.kind, p)}</span><span className="block text-sm text-muted-foreground">{p.title ? `${p.title} · ` : ""}{relativeTime(n.created_at)}</span></span>
              {!n.read_at && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
            </Link></li>
          ); })}
        </ul>
      )}
    </>
  );
}
