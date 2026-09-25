import { notFound } from "next/navigation";
import { requireActiveUser, initials } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { formatSize } from "@/lib/labels";
import { orderSlots } from "@/lib/slot-order";
import { UploadPanel } from "@/components/asset/upload-panel";
import { AssetHeader } from "@/components/asset/asset-header";
import { ReviewActions } from "@/components/asset/review-actions";
import { PreviewRefresher } from "@/components/asset/preview-refresher";
import { MARK_VERSION } from "@/config/marks";
import { AssetStage, type CommentView, type Member, type SideView } from "@/components/asset/asset-stage";
import type { AppUser, EventRow, Format, Slot } from "@/lib/types";

export default async function SlotPage({ params, searchParams }: { params: Promise<{ id: string; slotId: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id, slotId } = await params; const { v } = await searchParams;
  const { supabase, org, user } = await requireActiveUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle<EventRow>();
  if (!event || event.org_id !== org.id) notFound();
  const { data: slot } = await supabase.from("slots").select("*").eq("id", slotId).eq("event_id", id).maybeSingle<Slot>();
  if (!slot) notFound();
  const [{ data: fmt }, { data: versions }, { data: members }, { data: siblings }] = await Promise.all([
    supabase.from("formats").select("*").eq("id", slot.format_id).single<Format>(),
    supabase.from("versions").select("*,version_sides(*),uploader:uploaded_by(name,email)").eq("slot_id", slotId).order("number", { ascending: false }),
    supabase.from("users").select("id,name,email,avatar_url,role,is_approver,function_tags,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id),
    supabase.from("slots").select("id,is_primary,formats(name,sort),versions(created_at)").eq("event_id", id).eq("requested", true),
  ]);
  if (!fmt) notFound();

  // Previous / next format, in the same order as the event page.
  const ordered = orderSlots((siblings ?? []).map((s) => { const f = s.formats as unknown as { name: string; sort: number } | null; const vs = (s.versions as { created_at: string }[]) ?? []; return { id: s.id, name: f?.name ?? "", is_primary: s.is_primary, sort: f?.sort ?? 0, firstUploadAt: vs.length ? vs.map((x) => x.created_at).sort()[0] : null }; }));
  const at = ordered.findIndex((s) => s.id === slotId);
  const prev = at > 0 ? ordered[at - 1] : null; const next = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;

  const vlist = versions ?? [];
  const current = (v && vlist.find((x) => x.number === Number(v))) || vlist[0] || null;
  const rawSides = (current?.version_sides ?? []) as { id: string; side: "front" | "back"; width: number; height: number; mime: string; optimised_path: string | null; preview_path: string | null; thumb_path: string | null; reference_path: string | null; mark_version: number | null }[];
  const approved = current?.decision === "approved";
  const purged = !!current?.purged_at;
  const readOnly = event.status === "archived";
  const pick = (s: (typeof rawSides)[number]) => approved ? (s.optimised_path ?? s.reference_path) : (s.preview_path ?? s.optimised_path ?? s.reference_path);
  const sides: SideView[] = (await Promise.all(["front", "back"].map(async (k) => {
    const s = rawSides.find((x) => x.side === k); if (!s) return null;
    return { side: k as "front" | "back", src: await signedUrl(supabase, pick(s)), isGif: s.mime === "image/gif", width: s.width, height: s.height };
  }))).filter((s): s is SideView => !!s);
  const hasBack = sides.some((s) => s.side === "back");
  const stalePreviews = !approved && !purged ? rawSides.filter((s) => s.preview_path && s.mime !== "image/gif" && (s.mark_version ?? 0) < MARK_VERSION).map((s) => s.id) : [];

  // The whole conversation for this format, across versions: what was asked on v1 is the reason v2 exists.
  const versionNumber = new Map(vlist.map((x) => [x.id as string, x.number as number]));
  const { data: comments } = vlist.length ? await supabase.from("comments").select("*,author:author_id(name,email,avatar_url,role,is_approver,function_tags)").in("version_id", vlist.map((x) => x.id)).order("created_at") : { data: [] as never[] };
  const roleOf = (u: { role: string; is_approver: boolean; function_tags: string[] }) => u.role === "core_admin" ? "Core Admin" : u.is_approver ? "Approver" : u.function_tags?.[0] ? u.function_tags[0][0].toUpperCase() + u.function_tags[0].slice(1) : "Member";
  const cviews: CommentView[] = (comments ?? []).map((c) => { const a = c.author as unknown as { name: string | null; email: string; avatar_url: string | null; role: string; is_approver: boolean; function_tags: string[] }; return { id: c.id, version: versionNumber.get(c.version_id) ?? 0, body: c.body, created_at: c.created_at, pin_x: c.pin_x, pin_y: c.pin_y, pin_side: (c.pin_side ?? "front") as "front" | "back", edited_at: c.edited_at, mine: c.author_id === user.id, addressed_at: c.addressed_at, confirmed_at: c.confirmed_at, author: { name: a?.name ?? a?.email ?? "Someone", initials: initials(a?.name ?? null, a?.email ?? "?"), avatar: a?.avatar_url ?? null, role: a ? roleOf(a) : "" } }; });
  const mlist: Member[] = ((members ?? []) as unknown as Pick<AppUser, "id" | "name" | "email" | "avatar_url">[]).map((m) => ({ id: m.id, name: m.name ?? m.email.split("@")[0], handle: m.email.split("@")[0].toLowerCase(), avatar: m.avatar_url }));
  const canApprove = user.is_approver || user.role === "core_admin";
  const uploader = current?.uploader as unknown as { name: string | null; email: string } | null;
  const isPrint = fmt.class === "print";
  const print = isPrint && fmt.unit === "in" && fmt.width && fmt.height ? { bleedIn: Number(fmt.bleed_in ?? 0), safeIn: Number(fmt.safe_margin_in ?? 0), widthIn: Number(fmt.width), heightIn: Number(fmt.height) } : null;
  const safe = { top: fmt.safe_top, right: fmt.safe_right, bottom: fmt.safe_bottom, left: fmt.safe_left };
  // Safe bands are in pixels of the requested size; map them onto the uploaded pixels.
  const front = rawSides.find((s) => s.side === "front");
  const nativeW = fmt.allow_custom_size ? (slot.custom_w ?? front?.width ?? 0) : fmt.unit === "px" ? Number(fmt.width) : (front?.width ?? 0);
  const nativeH = fmt.allow_custom_size ? (slot.custom_h ?? front?.height ?? 0) : fmt.unit === "px" ? Number(fmt.height) : (front?.height ?? 0);
  const scaledSides = sides.map((s) => ({ ...s, width: nativeW || s.width, height: nativeH || s.height }));
  const sent = !!current?.sent_at;
  const state = !slot.requested ? "na" : current && !sent ? "unsent" : slot.state;
  const who = uploader ? (uploader.name ?? uploader.email) : null;
  const canUpload = user.role === "core_admin" || slot.assignee_id === user.id || user.function_tags.includes("designer");
  const canSend = !!current && current.decision === "pending" && (current.uploaded_by === user.id || slot.assignee_id === user.id || user.role === "core_admin");
  const actionProps = current && slot.requested && !readOnly ? { versionId: current.id, decision: current.decision, canApprove, isOwnUpload: current.uploaded_by === user.id, hasBack: hasBack && approved, sent, canSend } : null;

  const chips = vlist.map((x) => ({ id: x.id, number: x.number, decision: x.decision, canManage: x.uploaded_by === user.id || user.role === "core_admin", hasBack: ((x.version_sides as { side: string }[]) ?? []).some((sd) => sd.side === "back") }));
  const decision = actionProps ? <ReviewActions {...actionProps} label={`${fmt.name} v${current?.number ?? ""}`} eventTitle={event.title} layout="fill" /> : null;
  const decisionRow = actionProps ? <ReviewActions {...actionProps} label={`${fmt.name} v${current?.number ?? ""}`} eventTitle={event.title} /> : null;

  return (
    <div className={"pb-8" + (decision ? " max-md:pb-24" : "")}>
      <AssetHeader eventId={id} eventTitle={event.title} formatName={fmt.name} size={formatSize(fmt, { w: slot.custom_w, h: slot.custom_h })} position={{ at: at + 1, total: ordered.length }} prev={prev ? { id: prev.id, name: prev.name } : null} next={next ? { id: next.id, name: next.name } : null} />
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 pt-4 md:px-6 md:pt-6">
      {!slot.requested ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">This format is marked N/A for this event. Change it from Edit event → Formats if it is needed.</p>
      ) : vlist.length === 0 ? readOnly ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing was uploaded for this format before the event was archived.</p>
      ) : (
        <>
          {!event.brief_locked_at && <p className="text-xs text-muted-foreground">Uploading the first design locks the brief.</p>}
          {canUpload ? <UploadPanel slotId={slotId} accept={fmt.allowed_mimes} isPrint={isPrint} nextNumber={1} variant="dropzone" /> : <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing uploaded yet. The assigned designer will add the first version.</p>}
        </>
      ) : (
        <>
          {purged && <p className="rounded-2xl bg-subtle px-5 py-4 text-sm text-muted-foreground">{sides[0]?.src ? "Files for this event were removed a week after its date. This is the compressed reference of the approved version." : "This version was not approved, so its files were removed a week after the event. Comments and decisions are kept."}</p>}
          {stalePreviews.length > 0 && <PreviewRefresher sideIds={stalePreviews} />}
          <AssetStage versionId={current?.id ?? null} sides={scaledSides} safe={safe} print={print} comments={cviews} members={mlist} canComment={!readOnly} canModerate={user.role === "core_admin"}
            versions={chips} currentVersionId={current?.id ?? null} eventId={id} slotId={slotId} upload={canUpload && !readOnly ? { accept: fmt.allowed_mimes, isPrint, nextNumber: (vlist[0]?.number ?? 0) + 1 } : null}
            status={{ state: state as "requested" | "unsent", version: current?.number ?? null, uploader: purged ? (who ? `${who} (reference)` : "Reference") : who, uploadedAt: current?.created_at ?? null }} decision={decision} decisionBar={decisionRow} readOnly={readOnly} />
        </>
      )}
      </div>
    </div>
  );
}
