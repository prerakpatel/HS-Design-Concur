import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireActiveUser, initials } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { formatSize } from "@/lib/labels";
import { PageHeader, BackLink } from "@/components/page-header";
import { StateBadge } from "@/components/state-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { BriefCard, ActivityFeed } from "@/components/events/event-detail";
import { FormatGrid, type FormatCardData } from "@/components/events/format-grid";
import { EventMenu } from "@/components/events/event-menu";
import { deleteEvent } from "@/app/actions/events";
import { orderSlots } from "@/lib/slot-order";
import type { Brief, EventRow, Format, Slot } from "@/lib/types";

const VERB: Record<string, (p: Record<string, string>) => string> = { "event.created": () => "created the event", "event.published": () => "published the event", "event.deleted": () => "deleted the event", "version.uploaded": (p) => `uploaded ${p.format} v${p.number}`, "version.sent": (p) => `sent ${p.format} v${p.number} for review`, "version.deleted": (p) => `deleted ${p.format} v${p.number}`, "version.approved": (p) => `approved ${p.format} v${p.number}`, "version.changes_requested": (p) => `requested changes on ${p.format} v${p.number}`, "version.reopened": (p) => `reopened ${p.format} v${p.number}`, "event.archived": (p) => `archived the event · ${p.filesRemoved ?? 0} files reduced to references`, "event.restored": () => "restored the event" };

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activity?: string }> }) {
  const { id } = await params; const showActivity = (await searchParams).activity === "1";
  const { supabase, org, user } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const [{ data: brief }, { data: slots }, { data: formats }, { data: activity }, { data: creator }] = await Promise.all([
    supabase.from("briefs").select("*").eq("event_id", id).maybeSingle<Brief>(),
    supabase.from("slots").select("*,assignee:assignee_id(name,email,avatar_url),versions(id,number,uploaded_by,created_at,sent_at,version_sides(side,thumb_path,reference_path))").eq("event_id", id),
    supabase.from("formats").select("*").order("sort").returns<Format[]>(),
    supabase.from("activity").select("*,actor:actor_id(name,email,avatar_url)").eq("event_id", id).order("created_at", { ascending: false }).limit(12),
    supabase.from("users").select("name,email").eq("id", event.created_by).maybeSingle(),
  ]);
  const bySlotFormat = new Map((slots ?? []).map((s) => [s.format_id, s]));
  const cards: FormatCardData[] = orderSlots((await Promise.all((formats ?? []).map(async (f) => {
    const slot = bySlotFormat.get(f.id) as (Slot & { assignee: { name: string | null; email: string; avatar_url: string | null } | null; versions: { id: string; number: number; uploaded_by: string; created_at: string; sent_at: string | null; version_sides: { side: string; thumb_path: string | null; reference_path: string | null }[] }[] }) | undefined;
    if (!slot || (!f.active && !slot.requested)) return null;
    const latest = [...(slot.versions ?? [])].sort((a, b) => b.number - a.number)[0];
    const front = latest?.version_sides?.find((s) => s.side === "front");
    const thumb = await signedUrl(supabase, front?.thumb_path ?? front?.reference_path ?? null);
    return { slotId: slot.id, name: f.name, size: formatSize(f, { w: slot.custom_w, h: slot.custom_h }), state: latest && !latest.sent_at ? "unsent" : slot.state, requested: slot.requested, version: latest?.number ?? null, versionId: latest?.id ?? null, uploadedByMe: latest?.uploaded_by === user.id, thumb, due: slot.due_on, assignee: slot.assignee ? { name: slot.assignee.name ?? slot.assignee.email, initials: initials(slot.assignee.name, slot.assignee.email), avatar: slot.assignee.avatar_url } : null, isPrimary: slot.is_primary, sort: f.sort, firstUploadAt: slot.versions?.length ? slot.versions.map((x) => x.created_at).sort()[0] : null };
  }))).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({ ...c, is_primary: c.isPrimary }))).map((c) => { const { sort, firstUploadAt, is_primary, ...rest } = c; void sort; void firstUploadAt; void is_primary; return rest as FormatCardData; });
  const requested = cards.filter((c) => c.requested); const approved = requested.filter((c) => c.state === "approved").length;
  const canDelete = user.role === "core_admin" || event.created_by === user.id;
  const d = event.event_date ? format(new Date(event.event_date + "T00:00:00"), "EEE d MMM yyyy") : "Date not set";
  return (
    <>
      <PageHeader back={<BackLink href="/events" label="Events" />}
        title={event.title} subtitle={`${d} · ${event.venue ?? "Venue not set"}${creator ? ` · Created by ${creator.name ?? creator.email}` : ""}`}
        actions={<>{event.status === "archived" ? <StateBadge state="requested" label="Archived · read-only" className="h-8 px-3 text-sm" /> : <>{event.status === "draft" && <StateBadge state="draft" className="h-8 px-3 text-sm" />}<Button asChild variant="secondary"><Link href={`/events/${id}/edit/${event.status === "draft" ? "review" : "event"}`}>{event.status === "draft" ? "Continue setup" : "Edit event"}</Link></Button></>}<Button asChild variant={showActivity ? "secondary" : "outline"}><Link href={showActivity ? `/events/${id}` : `/events/${id}?activity=1`}><Icon name="history" className="!text-[18px]" />Activity{activity?.length ? ` · ${activity.length}` : ""}</Link></Button>{event.status !== "archived" && canDelete && <EventMenu title={event.title} isDraft={event.status === "draft"} remove={async () => { "use server"; await deleteEvent(id); }} />}</>} />
      <div className={showActivity ? "grid gap-10 lg:grid-cols-[1fr_280px]" : "grid gap-10"}>
        <div className="space-y-10">
          <BriefCard brief={{ date: event.event_date, timeText: brief?.time_text ?? null, inviteText: brief?.description ?? null, venueName: brief?.venue_name ?? event.venue ?? null, venueAddress: brief?.venue_address ?? null, notes: brief?.notes ?? null }} locked={!!event.brief_locked_at || event.status === "archived"} editHref={event.status === "archived" ? "#" : `/events/${id}/edit/event`} />
          <FormatGrid eventId={id} cards={cards} downloadable={cards.filter((c) => c.requested && c.state === "approved" && c.thumb).length} canApprove={event.status !== "archived" && (user.is_approver || user.role === "core_admin")} meta={`${approved} approved · ${requested.length - approved} in progress · ${cards.length - requested.length} N/A`} />
        </div>
        {showActivity && <ActivityFeed items={(activity ?? []).map((a) => { const who = a.actor as unknown as { name: string | null; email: string; avatar_url: string | null } | null; return { id: a.id, who: who?.name ?? who?.email ?? "Design & Concur", initials: initials(who?.name ?? null, who?.email ?? "?"), avatar: who?.avatar_url ?? null, what: (VERB[a.kind] ?? (() => a.kind))(a.payload as Record<string, string>), when: a.created_at }; })} />}
      </div>
    </>
  );
}
