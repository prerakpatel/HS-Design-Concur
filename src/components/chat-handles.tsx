"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/material-icon";
import { updateChatHandles, sendTestMention } from "@/app/actions/prefs";

// icons: check_circle schedule
/**
 * Profile › Chat: the one thing a person may need to type so chat posts can @-mention them (their Slack member
 * ID). Google Chat needs nothing: the Google account they sign in with is their Chat identity.
 */
export function ChatHandles({ slackId, gchatLinked, orgName }: { slackId: string | null; gchatLinked: boolean; orgName: string }) {
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [value, setValue] = useState(slackId ?? "");
  const dirty = value.trim().toUpperCase() !== (slackId ?? "");
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Chat mentions</h2>
      <form className="space-y-4 rounded-2xl border border-border p-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await updateChatHandles(fd); toast.success("Saved"); } catch (err) { toast.error((err as Error).message); } }); }}>
        <div className="flex items-start gap-3 text-sm">
          <Icon name={gchatLinked ? "check_circle" : "schedule"} size={20} fill={gchatLinked} className={gchatLinked ? "text-success-text" : "text-muted-foreground"} />
          <p><span className="font-medium">Google Chat</span> <span className="text-muted-foreground">{gchatLinked ? "linked through your Google sign-in." : "links itself the next time you sign in."}</span></p>
        </div>
        <div className="space-y-2">
          <label htmlFor="slack_user_id" className="text-sm font-medium">Slack member ID</label>
          <Input id="slack_user_id" name="slack_user_id" value={value} onChange={(e) => setValue(e.target.value)} placeholder="U0123ABCD" autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="font-mono uppercase" />
          <p className="text-sm text-muted-foreground">In Slack, open your profile → ⋮ → <span className="font-medium text-foreground">Copy member ID</span>. Leave empty if you are not on Slack; posts then show your name instead of pinging you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="outline" disabled={testing || dirty} onClick={() => startTest(async () => { try { await sendTestMention(); toast.success(`Sent to ${orgName}'s chat. Did it ping you?`); } catch (err) { toast.error((err as Error).message); } })}>{testing ? "Sending…" : "Send me a test mention"}</Button>
        </div>
      </form>
    </section>
  );
}
