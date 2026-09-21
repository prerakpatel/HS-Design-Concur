import Link from "next/link";
import { format } from "date-fns";
import { requireActiveUser } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { relativeTime } from "@/lib/labels";
import { restoreEvent } from "@/app/actions/admin";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { Icon } from "@/components/material-icon";
import { DELETE_RESTORE_DAYS, PURGE_AFTER_DAYS } from "@/config/limits";

export const metadata = { title: "Archive" };

interface ArchivedRow { id: string; title: string; event_date: string | null; archived_at: string | null; slots: { state: string; requested: boolean; versions: { decision: string; version_sides: { side: string; reference_path: string | null; thumb_path: string | null }[] }[] }[] }
/** Whole days left in the restore window; 0 once it has passed. */
function daysLeft(deletedAt: string) { return Math.max(0, Math.ceil(DELETE_RESTORE_DAYS - (Date.now() - new Date(deletedAt).getTime()) / 86400_000)); }

interface DeletedRow { id: string; title: string; event_date: string | null; status: string; deleted_at: string }

export default async function ArchivePage() {
  const { supabase, org, user } = await requireActiveUser();
  const [{ data: archived }, { data: deleted }] = await Promise.all([
    supabase.from("events").select("id,title,event_date,archived_at,slots(state,requested,versions(decision,version_sides(side,reference_path,thumb_path)))").eq("org_id", org.id).eq("status", "archived").is("deleted_at", null).order("event_date", { ascending: false }).returns<ArchivedRow[]>(),
    user.role === "core_admin" ? supabase.from("events").select("id,title,event_date,status,deleted_at").eq("org_id", org.id).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).returns<DeletedRow[]>() : Promise.resolve({ data: [] as DeletedRow[] }),
  ]);
  const cards = await Promise.all((archived ?? []).map(async (e) => {
    const approved = e.slots.filter((s) => s.requested && s.state === "approved");
    const front = approved.flatMap((s) => s.versions.filter((v) => v.decision === "approved")).flatMap((v) => v.version_sides).find((s) => s.side === "front");
    return { id: e.id, title: e.title, date: e.event_date, approved: approved.length, requested: e.slots.filter((s) => s.requested).length, cover: await signedUrl(supabase, front?.reference_path ?? front?.thumb_path ?? null) };
  }));
  const restorable = (deleted ?? []).map((d) => ({ ...d, left: daysLeft(d.deleted_at) })).filter((d) => d.left > 0);

  return (
    <>
      <PageHeader title="Archive" subtitle={`Read-only. Events arrive ${PURGE_AFTER_DAYS} days after their date with one compressed reference per approved format. Briefs, decisions and comments are kept.`} />
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-[15px] text-muted-foreground">Nothing archived yet. Events move here a week after their date.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {cards.map((c) => (
            <li key={c.id}>
              <Link href={`/events/${c.id}`} className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-foreground/25 hover:shadow-sm">
                <div className={"relative aspect-[5/4] " + (c.cover ? "bg-canvas" : "bg-muted")}>
                  {c.cover ? <img src={c.cover} alt="" className="absolute inset-0 size-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Icon name="inventory_2" size={24} /></div>}
                </div>
                <div className="space-y-1 p-4">
                  <p className="truncate text-[15px] font-medium leading-5">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.date ? format(new Date(c.date + "T00:00:00"), "d MMM yyyy") : "Undated"}</p>
                  <p className="text-sm text-muted-foreground">{c.approved} of {c.requested} approved</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {user.role === "core_admin" && restorable.length > 0 && (
        <section className="mt-14">
          <SectionHeader title="Recently deleted" meta={`Core Admins can restore for ${DELETE_RESTORE_DAYS} days; files go after that`} />
          <ul className="divide-y divide-border">
            {restorable.map((d) => {
              const left = d.left;
              return (
                <li key={d.id} className="flex items-center gap-4 py-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon name="delete" size={24} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium leading-5">{d.title}</p>
                    <p className="text-sm text-muted-foreground">{d.status === "draft" ? "Draft" : "Event"}{d.event_date ? ` · ${format(new Date(d.event_date + "T00:00:00"), "d MMM yyyy")}` : ""} · deleted {relativeTime(d.deleted_at)} · {left} day{left === 1 ? "" : "s"} left</p>
                  </div>
                  <ConfirmButton variant="secondary" label="Restore" title={`Restore “${d.title}”?`} description="It returns to the Events list exactly as it was." confirmLabel="Restore" action={restoreEvent.bind(null, d.id)} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
