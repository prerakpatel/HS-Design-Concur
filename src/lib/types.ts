export type UserRole = "member" | "core_admin";
export type UserStatus = "pending" | "active" | "removed";
export type FunctionTag = "central" | "publication" | "designer";
export type SlotState = "requested" | "in_review" | "changes_requested" | "approved";
export type EventStatus = "draft" | "active" | "archived";

export interface Organisation { id: string; slug: string; name: string; short_name: string; accepting_signups: boolean; email_enabled: boolean; chat_enabled: boolean; chat_webhook_url: string | null; slack_enabled: boolean; slack_webhook_url: string | null; logo_path: string | null; }
export interface AppUser { id: string; email: string; name: string | null; avatar_url: string | null; role: UserRole; is_approver: boolean; function_tags: FunctionTag[]; status: UserStatus; email_pref: "instant" | "digest" | "off"; slack_user_id: string | null; gchat_user_id: string | null; created_at: string; }
export interface Format { id: string; key: string; name: string; width: number | null; height: number | null; unit: "px" | "in"; dpi: number | null; class: "print" | "digital"; frame: "phone" | "card" | "flat" | "tv" | "led" | "print"; safe_top: number; safe_right: number; safe_bottom: number; safe_left: number; bleed_in: number | null; safe_margin_in: number | null; allow_custom_size: boolean; allowed_mimes: string[]; notes: string | null; active: boolean; sort: number; }
export interface Brief { event_id: string; description: string | null; time_text: string | null; venue_name: string | null; venue_address: string | null; notes: string | null; }
export interface EventRow { id: string; org_id: string; title: string; event_date: string | null; venue: string | null; status: EventStatus; created_by: string; brief_locked_at: string | null; deleted_at: string | null; archived_at: string | null; purged_at: string | null; last_edited_at: string; created_at: string; }
export interface Slot { id: string; event_id: string; format_id: string; requested: boolean; custom_w: number | null; custom_h: number | null; notes: string | null; assignee_id: string | null; due_on: string | null; state: SlotState; is_primary: boolean; }

export const SLOT_STATE_LABEL: Record<SlotState | "na" | "draft" | "needs_you" | "unsent", string> = {
  requested: "Requested", in_review: "In review", changes_requested: "Changes requested", approved: "Approved", na: "N/A", draft: "Draft", needs_you: "Needs you", unsent: "Not sent yet",
};
