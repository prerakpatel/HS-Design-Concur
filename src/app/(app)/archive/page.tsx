import { format } from "date-fns";
import { requireActiveUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import type { EventRow } from "@/lib/types";

export const metadata = { title: "Archive" };

export default async function ArchivePage() {
  const { supabase, org } = await requireActiveUser();
  const { data } = await supabase.from("events").select("*").eq("org_id", org.id).eq("status", "archived").order("event_date", { ascending: false }).returns<EventRow[]>();
  const items = data ?? [];
  return (
    <>
      <PageHeader title="Archive" subtitle="Read-only. One compressed reference per approved format; briefs, decisions and comments are kept." />
      {items.length === 0 ? <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-[15px] text-muted-foreground">No archived events yet. Events move here a week after their date, or when they are more than six months old.</p> : (
        <ul className="grid gap-5 md:grid-cols-3">{items.map((e) => <li key={e.id} className="rounded-2xl border border-border p-5"><p className="text-[15px] font-medium">{e.title}</p><p className="mt-1 text-sm text-muted-foreground">{e.event_date ? format(new Date(e.event_date + "T00:00:00"), "d MMM yyyy") : ""} · {org.short_name}</p></li>)}</ul>
      )}
    </>
  );
}
