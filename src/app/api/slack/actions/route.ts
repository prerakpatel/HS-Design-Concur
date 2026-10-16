import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { verifySlackSignature } from "@/lib/slack-verify";
import { replaceSlackMessage, whisperSlack } from "@/lib/slack-dm";
import { markDoneBlocks, testDoneBlocks, MARK_DONE, TEST_PING, type SlackBlock } from "@/lib/slack-blocks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface Payload { type?: string; user?: { id?: string }; response_url?: string; actions?: { action_id?: string; value?: string }[]; message?: { blocks?: SlackBlock[] } }

/**
 * Where Slack sends button presses (Slack app → Interactivity & Shortcuts → Request URL). Nothing here is trusted until
 * the request proves it was signed with the app's signing secret. The person is then found by their Slack member ID and
 * may only do what they could do in the app: a change request is marked done by anyone on its project (a member of
 * its organisation, or a guest on its People list).
 */
export async function POST(req: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return new Response("Slack buttons are not set up", { status: 503 });
  const raw = await req.text();
  if (!verifySlackSignature(secret, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"), raw)) return new Response("Bad signature", { status: 401 });

  let payload: Payload;
  try { payload = JSON.parse(new URLSearchParams(raw).get("payload") ?? "{}") as Payload; } catch { return new Response("Bad request", { status: 400 }); }
  const action = payload.actions?.[0]; const responseUrl = payload.response_url;
  if (payload.type !== "block_actions" || !action || !responseUrl || !payload.user?.id) return new Response(null, { status: 200 });

  // Slack wants an answer within three seconds: the work happens after replying; the message is updated when it is done.
  after(async () => {
    const db = createServiceClient();
    const { data: people } = await db.from("users").select("id,name,email").eq("slack_user_id", payload.user!.id!).eq("status", "active").limit(1);
    const me = people?.[0];
    if (!me) return whisperSlack(responseUrl, "Your Slack account is not linked to a Design & Concur account yet. Ask an admin to add your Slack member ID in Settings → Users.");

    if (action.action_id === TEST_PING) return replaceSlackMessage(responseUrl, "Button test", testDoneBlocks(me.name ?? me.email));
    if (action.action_id !== MARK_DONE || !action.value || !UUID.test(action.value)) return;

    const blocks = payload.message?.blocks ?? [];
    const { data: c } = await db.from("comments").select("id,is_draft,needs_change,addressed_at,confirmed_at,versions(slots(id,event_id,events(org_id,status,deleted_at)))").eq("id", action.value).maybeSingle();
    const slot = (c?.versions as unknown as { slots: { id: string; event_id: string; events: { org_id: string; status: string; deleted_at: string | null } } } | null)?.slots;
    if (!c || !slot || c.is_draft || slot.events.deleted_at) return replaceSlackMessage(responseUrl, "Change no longer open", markDoneBlocks(blocks, action.value, "no longer open"));

    const { data: member } = await db.from("org_memberships").select("user_id").eq("user_id", me.id).eq("org_id", slot.events.org_id).limit(1);
    let allowed = !!member?.length;
    if (!allowed) { const { data: guest } = await db.from("project_members").select("event_id").eq("event_id", slot.event_id).eq("email", me.email.toLowerCase()).limit(1); allowed = !!guest?.length && slot.events.status === "active"; }
    if (!allowed) return whisperSlack(responseUrl, "You do not have access to that project.");
    if (slot.events.status === "archived") return whisperSlack(responseUrl, "That project is archived and read-only.");

    // Already done (here, in the app, or confirmed by an approver) counts as done: pressing twice is harmless.
    if (!c.addressed_at && !c.confirmed_at) {
      const { error } = await db.from("comments").update({ addressed_at: new Date().toISOString(), addressed_by: me.id }).eq("id", c.id).is("addressed_at", null).is("confirmed_at", null);
      if (error) { console.error("[slack actions]", error.message); return whisperSlack(responseUrl, "Could not mark that as done. Please try in the app."); }
      revalidatePath(`/events/${slot.event_id}/slots/${slot.id}`);
    }
    return replaceSlackMessage(responseUrl, "Marked as done", markDoneBlocks(blocks, c.id));
  });
  return new Response(null, { status: 200 });
}
