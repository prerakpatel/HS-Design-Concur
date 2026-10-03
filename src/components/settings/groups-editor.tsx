"use client";
import { useState, useTransition } from "react";
import { PeoplePicker, type PickablePerson } from "@/components/settings/people-picker";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { TestButton } from "@/components/settings/test-button";
import { Field } from "@/components/settings/user-editor";
import { saveGroup, deleteGroup, testGroupChat } from "@/app/actions/groups";
import { HEARS_LABEL, type Group, type GroupHears } from "@/lib/groups";
import { errorMessage } from "@/lib/user-error";

// icons: group_add chevron_right groups
export type GroupUser = PickablePerson;

/**
 * Settings › Groups: people + a chat home + what they hear about. One calm row per group; tap to edit. Chat posts
 * route to the groups of the people concerned (src/lib/notify.ts), and "@Group" in a comment reaches its chat.
 */
export function GroupsEditor({ groups, users }: { groups: Group[]; users: GroupUser[] }) {
  const [open, setOpen] = useState<Group | "new" | null>(null);
  const byId = new Map(users.map((u) => [u.id, u]));
  return (
    <section className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">A group is a set of people, a chat channel or space of their own, and a rule for what lands there. Design posts go to the groups of the people they concern; event milestones go to every group. Mention a group in a comment (@Core members) to send that comment to its chat.</p>
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">No groups yet. Everything posts to the organization&apos;s channels.</p>
      ) : (
        <ul className="divide-y divide-border">
          {groups.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => setOpen(g)} className="-mx-3 flex w-[calc(100%+24px)] items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-subtle">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name="groups" size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{HEARS_LABEL[g.hears].label} · {g.members.length} {g.members.length === 1 ? "person" : "people"} · {[g.chat_webhook_url && "Google Chat", g.slack_webhook_url && "Slack"].filter(Boolean).join(" + ") || "no chat yet"}</span>
                </span>
                <span className="hidden -space-x-2 sm:flex">{g.members.slice(0, 5).map((id) => { const u = byId.get(id); return u ? <UserAvatar key={id} initials={u.initials} src={u.avatar} size={28} className="ring-2 ring-background" /> : null; })}</span>
                <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" onClick={() => setOpen("new")}><Icon name="group_add" />New group</Button>
      <GroupPanel group={open} users={users} onClose={() => setOpen(null)} />
    </section>
  );
}

function GroupPanel({ group, users, onClose }: { group: Group | "new" | null; users: GroupUser[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const g = group === "new" ? null : group;
  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[560px]">
        {group && (
          <form key={g?.id ?? "new"} className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await saveGroup(g?.id ?? null, fd); toast.success(g ? "Group saved" : "Group created"); onClose(); router.refresh(); } catch (err) { toast.error(errorMessage(err)); } }); }}>
            <DialogHeader className="border-b border-border px-6 py-5 text-left"><DialogTitle className="text-lg">{g ? g.name : "New group"}</DialogTitle><DialogDescription>{g ? "Members, chat home and what the group hears about." : "A team with its own channel: designers, social media, core members…"}</DialogDescription></DialogHeader>
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <div className="space-y-2"><Label htmlFor="g-name">Name</Label><Input id="g-name" name="name" required defaultValue={g?.name ?? ""} placeholder="e.g. Core members" /></div>
              <HearsPicker defaultValue={g?.hears ?? "own"} />
              <Field label="People" hint="Someone can be in several groups.">
                <PeoplePicker name="member" people={users} defaultValue={g?.members ?? []} placeholder="Search by name…" />
              </Field>
              <Field label="Chat home" hint="A Google Chat space and/or a Slack channel of the group's own. Webhooks exist for spaces and channels, not for direct-message groups.">
                <div className="space-y-2"><Label htmlFor="g-chat">Google Chat webhook URL</Label><Input id="g-chat" name="chat_webhook_url" defaultValue={g?.chat_webhook_url ?? ""} placeholder="https://chat.googleapis.com/v1/spaces/…" /></div>
                <div className="space-y-2"><Label htmlFor="g-slack">Slack webhook URL</Label><Input id="g-slack" name="slack_webhook_url" defaultValue={g?.slack_webhook_url ?? ""} placeholder="https://hooks.slack.com/services/…" /></div>
                {g && <div className="flex flex-wrap gap-2">{g.chat_webhook_url && <TestButton label="Test Google Chat" action={async () => { await testGroupChat(g.id, "chat"); }} />}{g.slack_webhook_url && <TestButton label="Test Slack" action={async () => { await testGroupChat(g.id, "slack"); }} />}</div>}
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              {g ? <ConfirmButton variant="ghost" label="Delete group" title={`Delete “${g.name}”?`} description="Members keep their accounts; posts for them fall back to the organization's channels." confirmLabel="Delete" action={async () => { await deleteGroup(g.id); onClose(); }} /> : <span />}
              <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : g ? "Save changes" : "Create group"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The three "hears about" choices with one line of explanation for whichever is picked. */
function HearsPicker({ defaultValue }: { defaultValue: GroupHears }) {
  const [hears, setHears] = useState<GroupHears>(defaultValue);
  return (
    <Field label="Hears about">
      <ChoiceChips name="hears" defaultValue={defaultValue} onChange={(v) => setHears((v[0] as GroupHears) ?? defaultValue)} options={(Object.keys(HEARS_LABEL) as GroupHears[]).map((k) => ({ value: k, label: HEARS_LABEL[k].label }))} />
      <p className="text-sm text-muted-foreground">{HEARS_LABEL[hears].hint}</p>
    </Field>
  );
}
