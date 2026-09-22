"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

const MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

async function requireCatalogEditor() {
  const ctx = await requireActiveUser();
  if (ctx.user.role !== "core_admin" && !ctx.user.function_tags.includes("designer")) throw new Error("Designers and Core Admins only");
  return ctx;
}

const num = (v: FormData, k: string) => { const s = String(v.get(k) ?? "").trim(); return s === "" ? null : Number(s); };
const int = (v: FormData, k: string) => Math.max(0, Math.round(num(v, k) ?? 0));
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "format";

/** Create or update a catalog format (PRD §9). New formats are added to every open event as N/A. */
export async function saveFormat(formData: FormData) {
  const { supabase } = await requireCatalogEditor();
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const cls = formData.get("class") === "print" ? "print" : "digital";
  const unit = formData.get("unit") === "in" ? "in" : "px";
  const allow_custom_size = formData.get("allow_custom_size") === "on";
  const width = allow_custom_size ? null : num(formData, "width");
  const height = allow_custom_size ? null : num(formData, "height");
  if (!allow_custom_size && (!width || !height)) throw new Error("Width and height are required unless the size is custom");
  const mimes = formData.getAll("mime").map(String).filter((m) => MIMES.includes(m));
  if (mimes.length === 0) throw new Error("Pick at least one file type");
  const row = {
    name, class: cls, unit, width, height, dpi: cls === "print" ? (num(formData, "dpi") ?? 300) : null,
    frame: String(formData.get("frame") ?? "flat"),
    safe_top: int(formData, "safe_top"), safe_right: int(formData, "safe_right"), safe_bottom: int(formData, "safe_bottom"), safe_left: int(formData, "safe_left"),
    bleed_in: cls === "print" ? num(formData, "bleed_in") : null, safe_margin_in: cls === "print" ? num(formData, "safe_margin_in") : null,
    allow_custom_size, allowed_mimes: mimes, notes: String(formData.get("notes") ?? "").trim() || null, active: formData.get("active") !== "off",
  };
  if (id) {
    const { error } = await supabase.from("formats").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: last } = await supabase.from("formats").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const base = slug(name); let key = base;
    for (let n = 2; n < 50; n++) {
      const { data: taken } = await supabase.from("formats").select("id").eq("key", key).maybeSingle();
      if (!taken) break; key = `${base}_${n}`;
    }
    const { data: created, error } = await supabase.from("formats").insert({ ...row, key, sort: (last?.sort ?? 0) + 1 }).select("id").single();
    if (error || !created) throw new Error(error?.message ?? "Could not create the format");
    const { data: open } = await supabase.from("events").select("id").neq("status", "archived").is("deleted_at", null);
    if (open?.length) await supabase.from("slots").upsert(open.map((e) => ({ event_id: e.id, format_id: created.id, requested: false })), { onConflict: "event_id,format_id", ignoreDuplicates: true });
  }
  revalidatePath("/settings"); revalidatePath("/events");
}

