import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveUser, initials } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { formatSize } from "@/lib/labels";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { UploadPanel } from "@/components/asset/upload-panel";
import { ReviewActions } from "@/components/asset/review-actions";
import { CommentsPanel, type CommentView, type Member } from "@/components/asset/comments";
import type { AppUser, EventRow, Format, Slot } from "@/lib/types";

export default async function SlotPage({ params, searchParams }: { params: Promise<{ id: string; slotId: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id, slotId } = await params; const { v } = await searchParams;
  const { supabase, org, user } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const { data: slot } = await supabase.from("slots").select("*").eq("id", slotId).eq("event_id", id).maybeSingle<Slot>();
  if (!slot) notFound();
  const [{ data: fmt }, { data: versions }, { data: members }] = await Promise.all([
    supabase.from("formats").select("*").eq("id", slot.format_id).single<Format>(),
    supabase.from("versions").select("*,version_sides(*),uploader:uploaded_by(name,email)").eq("slot_id", slotId).order("number", { ascending: false }),
    supabase.from("users").select("id,name,email,role,is_approver,function_tags,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id),
  ]);
  if (!fmt) notFound();
  const vlist = versions ?? [];
  const current = (v && vlist.find((x) => x.number === Number(v))) || vlist[0] || null;
  const sides = (current?.version_sides ?? []) as { side: string; width: number; height: number; mime: string; optimised_path: string; preview_path: string | null; thumb_path: string | null }[];
  const front = sides.find((s) => s.side === "front") ?? sides[0] ?? null;
  const back = sides.find((s) => s.side === "back") ?? null;
  const approved = current?.decision === "approved";
  const [previewUrl, backUrl, downloadUrl] = await Promise.all([
    front ? signedUrl(supabase, approved ? front.optimised_path : (front.preview_path ?? front.optimised_path)) : null,
    back ? signedUrl(supabase, approved ? back.optimised_path : (back.preview_path ?? back.optimised_path)) : null,
    front && approved ? signedUrl(supabase, front.optimised_path, 120) : null,
  ]);
  const { data: comments } = current ? await supabase.from("comments").select("*,author:author_id(name,email,role,is_approver,function_tags)").eq("version_id", current.id).order("created_at") : { data: [] as never[] };
  const roleOf = (u: { role: string; is_approver: boolean; function_tags: string[] }) => u.role === "core_admin" ? "Core Admin" : u.is_approver ? "Approver" : u.function_tags?.[0] ? u.function_tags[0][0].toUpperCase() + u.function_tags[0].slice(1) : "Member";
  const cviews: CommentView[] = (comments ?? []).map((c) => { const a = c.author as unknown as { name: string | null; email: string; role: string; is_approver: boolean; function_tags: string[] }; return { id: c.id, body: c.body, created_at: c.created_at, pin_x: c.pin_x, pin_y: c.pin_y, addressed_at: c.addressed_at, confirmed_at: c.confirmed_at, author: { name: a?.name ?? a?.email ?? "Someone", initials: initials(a?.name ?? null, a?.email ?? "?"), role: a ? roleOf(a) : "" } }; });
  const mlist: Member[] = ((members ?? []) as unknown as Pick<AppUser, "id" | "name" | "email">[]).map((m) => ({ id: m.id, name: m.name ?? m.email.split("@")[0], handle: m.email.split("@")[0].toLowerCase() }));
  const canApprove = user.is_approver || user.role === "core_admin";
  const uploader = current?.uploader as unknown as { name: string | null; email: string } | null;
  const nativeW = fmt.allow_custom_size ? (slot.custom_w ?? front?.width ?? 0) : fmt.unit === "px" ? Number(fmt.width) : (front?.width ?? 0);
  const nativeH = fmt.allow_custom_size ? (slot.custom_h ?? front?.height ?? 0) : fmt.unit === "px" ? Number(fmt.height) : (front?.height ?? 0);
  const state = !slot.requested ? "na" : slot.state;
  const caption = current ? (approved ? `Approved · v${current.number}` : `DRAFT · v${current.number} · ${new Date(current.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`) : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <Link href={`/events/${id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Icon name="arrow_back" className="!text-[16px]" />{event.title}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">{fmt.name}</h1>
            {current && <span className="text-sm text-muted-foreground">v{current.number}</span>}
            <StateBadge state={state as "requested"} />
            {current && uploader && <span className="text-xs text-muted-foreground">· {uploader.name ?? uploader.email}</span>}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{formatSize(fmt, { w: slot.custom_w, h: slot.custom_h })} · {fmt.class}{slot.notes ? ` · ${slot.notes}` : ""}</p>
        </div>
        {current && slot.requested && <ReviewActions versionId={current.id} label={`${fmt.name} v${current.number}`} eventTitle={event.title} decision={current.decision} canApprove={canApprove} isOwnUpload={current.uploaded_by === user.id} downloadUrl={downloadUrl} />}
      </div>

      {vlist.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-muted p-1 text-xs font-medium">
            {[...vlist].reverse().map((x) => <Link key={x.id} href={`/events/${id}/slots/${slotId}?v=${x.number}`} className={"rounded-full px-3 py-1 " + (current?.id === x.id ? "bg-card shadow-sm" : "text-muted-foreground")}>v{x.number}{x.decision === "approved" ? " ✓" : ""}</Link>)}
          </div>
          {slot.requested && <UploadPanel slotId={slotId} accept={fmt.allowed_mimes} isPrint={fmt.class === "print"} nextNumber={(vlist[0]?.number ?? 0) + 1} compact />}
        </div>
      )}

      {!slot.requested ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">This format is marked N/A for this event. Change it from Edit event → Formats if it is needed.</p>
      ) : vlist.length === 0 ? (
        <>
          {!event.brief_locked_at && <p className="text-xs text-muted-foreground">Uploading the first design locks the brief.</p>}
          <UploadPanel slotId={slotId} accept={fmt.allowed_mimes} isPrint={fmt.class === "print"} nextNumber={1} />
        </>
      ) : (
        <>
          <CommentsPanel versionId={current?.id ?? null} viewer={{ src: previewUrl, isGif: front?.mime === "image/gif", width: nativeW, height: nativeH, safe: { top: fmt.safe_top, right: fmt.safe_right, bottom: fmt.safe_bottom, left: fmt.safe_left }, caption, frame: fmt.frame }} comments={cviews} members={mlist} canApprove={canApprove} canComment />
          {fmt.class === "print" && back && backUrl && <div className="rounded-2xl bg-canvas p-4"><p className="mb-2 text-xs font-medium text-muted-foreground">Back</p><img src={backUrl} alt="Back side" className="mx-auto max-h-[520px] rounded-xl shadow-md" /></div>}
        </>
      )}
    </div>
  );
}
