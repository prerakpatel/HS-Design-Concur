import type { SupabaseClient } from "@supabase/supabase-js";

/** Slack Web API with the workspace bot token (scopes: users:read, users:read.email). Absent token → feature off. */
export function slackConfigured() { return Boolean(process.env.SLACK_BOT_TOKEN); }

/** The Slack member ID for an email address, or null when Slack has no such member (or the token is missing). */
export async function slackLookupByEmail(email: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = (await res.json()) as { ok: boolean; error?: string; user?: { id: string; deleted?: boolean; is_bot?: boolean } };
    if (!data.ok) { if (data.error !== "users_not_found") console.error("[slack]", data.error); return null; }
    return data.user && !data.user.deleted && !data.user.is_bot ? data.user.id : null;
  } catch (e) { console.error("[slack]", (e as Error).message); return null; }
}

/**
 * Fill in slack_user_id for every active user who has none, by email. Runs daily and from the Settings button;
 * people whose Slack email differs from their sign-in email keep the manual field on their Profile.
 */
export async function matchSlackIds(db: SupabaseClient): Promise<{ matched: number; unmatched: string[] }> {
  if (!slackConfigured()) return { matched: 0, unmatched: [] };
  const { data: users } = await db.from("users").select("id,email").in("status", ["active", "pending"]).is("slack_user_id", null);
  let matched = 0; const unmatched: string[] = [];
  for (const u of users ?? []) {
    const id = await slackLookupByEmail(u.email);
    if (id) { await db.from("users").update({ slack_user_id: id }).eq("id", u.id); matched++; } else unmatched.push(u.email);
  }
  return { matched, unmatched };
}
