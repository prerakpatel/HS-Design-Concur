import { requireActiveUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import type { EventRow } from "@/lib/types";

export const metadata = { title: "Archive" };

export default async function ArchivePage() {
  const { supabase, org } = await requireActiveUser();
  const { data } = await supabase.from("events").select("*").eq("org_id", org.id).eq("status", "archived").order("event_date", { ascending: false }).returns<EventRow[]>();
  const items = data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Archive" subtitle="Read-only. One compressed reference per approved format. Briefs, decisions and comments are kept." />
      {items.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No archived events yet. Events move here a week after their date, or when they are more than six months old.</p> : (
        <ul className="grid gap-4 md:grid-cols-3">{items.map((e) => <li key={e.id} className="rounded-2xl border border-border p-4 text-sm font-medium">{e.title}</li>)}</ul>
      )}
    </div>
  );
}
