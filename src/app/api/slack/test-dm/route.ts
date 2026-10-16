import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendSlackBlocks, slackActionsEnabled } from "@/lib/slack-dm";
import { testBlocks } from "@/lib/slack-blocks";

/**
 * Core Admins only: sends the signed-in admin one Slack message with a test button, to check the whole chain (the
 * Slack app, the signing secret, the Interactivity address, the link between their Slack ID and their account).
 * Open it in the browser, then press the button in Slack. Nobody else is messaged.
 */
export async function GET() {
  const ctx = await getActiveUser();
  if (ctx?.user.role !== "core_admin") return NextResponse.json({ error: "Core Admins only" }, { status: 403 });
  if (!slackActionsEnabled()) return NextResponse.json({ ok: false, problem: "SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET must both be set in Vercel (Production)." });
  const { data: me } = await createServiceClient().from("users").select("slack_user_id").eq("id", ctx.user.id).maybeSingle();
  if (!me?.slack_user_id) return NextResponse.json({ ok: false, problem: "Your account has no Slack member ID. Add it in Settings → Users, or on your Profile." });
  const sent = await sendSlackBlocks(me.slack_user_id, "Design & Concur button test", testBlocks());
  return NextResponse.json("error" in sent ? { ok: false, problem: sent.error } : { ok: true, next: "Open Slack: you have a direct message from the app. Press the button." });
}
