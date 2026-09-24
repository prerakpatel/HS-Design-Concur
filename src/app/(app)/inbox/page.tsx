import Link from "next/link";
import { requireActiveUser } from "@/lib/auth";
import { markAllRead } from "@/app/actions/inbox";
import { updateEmailPref } from "@/app/actions/prefs";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { SelectField } from "@/components/ui/select-field";
import { notificationText, notificationHref, relativeTime } from "@/lib/labels";
import { PushToggle } from "@/components/push-toggle";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Inbox" };
const ICONS: Record<string, string> = { "access.approved": "how_to_reg", "slot.assigned": "assignment_ind", "slot.due": "schedule", "event.published": "campaign", "version.uploaded": "upload", "review.waiting": "pending_actions", "version.changes_requested": "rule", "version.approved": "check_circle", "version.reopened": "replay", "comment.mention": "alternate_email", "comment.posted": "chat_bubble", "versions.approved": "done_all", "event.all_approved": "celebration", "access.requested": "person_add", "event.archived": "inventory_2", "event.deleted": "delete", "draft.expiring": "hourglass_top", "draft.swept": "auto_delete", "devices.refresh": "devices" };

export default async function InboxPage() {
  const { supabase, user } = await requireActiveUser();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
  const items = data ?? []; const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader title="Inbox" subtitle={unread ? `${unread} unread` : "All caught up"} actions={unread ? <form action={markAllRead}><Button variant="secondary" type="submit">Mark all read</Button></form> : null} />
      <div className="mb-8 space-y-3">
      <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      {/* Email is on hold until a sender domain exists; the row appears by itself once RESEND_API_KEY and EMAIL_FROM are set. */}
      {emailConfigured() && (
      <form action={updateEmailPref} className="flex flex-col gap-3 rounded-2xl bg-subtle p-5 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">Email me</p><p className="text-sm text-muted-foreground">Approvals, mentions, assignments and due dates. Everything always shows here too.</p></div>
        <div className="flex gap-2"><SelectField name="email_pref" defaultValue={user.email_pref} className="w-52"><option value="instant">as things happen</option><option value="digest">once a day</option><option value="off">never</option></SelectField><Button type="submit" variant="secondary" size="lg">Save</Button></div>
      </form>
      )}
      </div>
      {items.length === 0 ? <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">Nothing yet. Assignments, mentions, approvals and due-date reminders land here.</p> : (
        <ul className="divide-y divide-border">
          {items.map((n) => { const p = n.payload as Record<string, unknown>; return (
            <li key={n.id}><Link href={notificationHref(p)} className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 hover:bg-subtle">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name={ICONS[n.kind] ?? "notifications"} size={20} /></span>
              <span className="min-w-0 flex-1"><span className={"block text-sm leading-6 " + (n.read_at ? "" : "font-medium")}>{notificationText(n.kind, p)}</span><span className="block text-sm text-muted-foreground">{p.title ? `${p.title} · ` : ""}{relativeTime(n.created_at)}</span></span>
              {!n.read_at && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
            </Link></li>
          ); })}
        </ul>
      )}
    </>
  );
}
