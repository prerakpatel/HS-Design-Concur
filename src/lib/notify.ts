import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "access.approved" | "slot.assigned" | "comment.mention" | "version.uploaded"
  | "version.changes_requested" | "version.approved" | "version.reopened" | "event.deleted" | "event.published";

/** In-app notifications for a set of users. Email and Google Chat fan-out hang off this later. */
export async function notify(supabase: SupabaseClient, userIds: Iterable<string>, kind: NotificationKind, payload: Record<string, unknown>, exclude?: string) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exclude);
  if (ids.length === 0) return;
  await supabase.from("notifications").insert(ids.map((user_id) => ({ user_id, kind, payload })));
}

/** Everyone "on the event" (PRD §6.2) via the event_participants() SQL helper. */
export async function eventParticipants(supabase: SupabaseClient, eventId: string): Promise<string[]> {
  const { data } = await supabase.rpc("event_participants", { p_event: eventId });
  return (data as { event_participants: string }[] | string[] | null)?.map((r) => (typeof r === "string" ? r : r.event_participants)) ?? [];
}
