"use client";
// icons: check_circle radio_button_unchecked
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { UserAvatar } from "@/components/user-avatar";
import { Switch } from "@/components/ui/switch";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { updateUser, removeUser, disableUser, enableUser } from "@/app/actions/admin";
import { toastError } from "@/lib/toast-error";

export interface EditableUser { id: string; name: string; email: string; initials: string; avatar?: string | null; role: "member" | "core_admin"; approverOrgIds: string[]; glossarySteward: boolean; function_tags: string[]; orgIds: string[]; groupIds?: string[]; email_pref?: "instant" | "digest" | "off"; slack_user_id?: string | null; gchat_user_id?: string | null; status?: "active" | "disabled"; hideInLists?: boolean; assistant?: boolean }
export interface OrgOption { id: string; label: string }
const TAGS = [{ value: "central", label: "Central" }, { value: "publication", label: "Publication" }, { value: "designer", label: "Designer" }];
const tagLabel = (t: string) => TAGS.find((x) => x.value === t)?.label ?? t;

/** Users list: one calm row per person; tap opens a side sheet with the full editor. */
export function UsersList({ users, orgs, groups = [], currentUserId, canGrantAssistant = false }: { users: EditableUser[]; orgs: OrgOption[]; groups?: OrgOption[]; currentUserId: string; /** The assistant's owner sees a switch per person. */ canGrantAssistant?: boolean }) {
  const [open, setOpen] = useState<EditableUser | null>(null);
  return (
    <>
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => setOpen(u)} className={"-mx-3 flex w-[calc(100%+24px)] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-subtle md:gap-4 " + (u.status === "disabled" ? "opacity-60" : "")}>
              <UserAvatar initials={u.initials} src={u.avatar} size={36} />
              <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px_92px] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-5">{u.name}{u.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>}
                    {u.status === "disabled" && <span className="ml-2 rounded-full bg-muted px-2 py-px text-[11px] font-medium text-muted-foreground">Disabled</span>}
                    {u.hideInLists && <span title="Left out of @ lists and pickers" className="ml-2 rounded-full bg-muted px-2 py-px text-[11px] font-medium text-muted-foreground">Hidden</span>}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{u.email}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:mt-0">
                  {u.role === "core_admin" ? <StateBadge state="in_review" label="Core Admin" /> : <StateBadge state="requested" label="Member" />}
                  {u.glossarySteward && <StateBadge state="in_review" label="Glossary" />}
                  {u.assistant && <StateBadge state="approved" label="Assistant" />}
                  {u.approverOrgIds.length > 0 && <StateBadge state="approved" label={u.approverOrgIds.length >= orgs.length ? "Approver" : `Approver · ${orgs.filter((o) => u.approverOrgIds.includes(o.id)).map((o) => o.label).join(", ")}`} />}
                  <span className="ml-1 text-[13px] text-muted-foreground md:hidden">{u.function_tags.map(tagLabel).join(" · ") || "No function"}</span>
                </div>
                <div className="hidden flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground md:flex">
                  {u.function_tags.length ? u.function_tags.map((t) => <span key={t}>{tagLabel(t)}</span>) : <span className="text-muted-foreground/70">No function</span>}
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground md:mt-0">
                  <p className="truncate">{orgs.filter((o) => u.orgIds.includes(o.id)).map((o) => o.label).join(", ") || "No org"}{u.email_pref && <span className="text-muted-foreground/80 md:hidden"> · Email {u.email_pref === "instant" ? "as it happens" : u.email_pref === "digest" ? "daily" : "off"}</span>}</p>
                  {u.email_pref && <p className="hidden truncate text-xs text-muted-foreground/80 md:block">Email {u.email_pref === "instant" ? "as it happens" : u.email_pref === "digest" ? "daily" : "off"}</p>}
                </div>
                <ChatLinks u={u} />
              </div>
              <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <UserPanel user={open} orgs={orgs} groups={groups} isSelf={open?.id === currentUserId} canGrantAssistant={canGrantAssistant} onClose={() => setOpen(null)} />
    </>
  );
}

/** Which chat accounts are linked, at a glance (the IDs themselves are in the person's panel). */
function ChatLinks({ u }: { u: EditableUser }) {
  const item = (label: string, on: boolean) => (
    <span key={label} title={on ? `${label} is linked` : `No ${label} ID yet`} className={"inline-flex items-center gap-1 text-xs " + (on ? "text-success-text" : "text-muted-foreground/70")}>
      <Icon name={on ? "check_circle" : "radio_button_unchecked"} className="!text-[14px]" fill={on} />{label}
    </span>
  );
  return <div className="mt-1 flex items-center gap-3 md:mt-0 md:flex-col md:items-start md:gap-0.5">{item("Slack", !!u.slack_user_id)}{item("Chat", !!u.gchat_user_id)}</div>;
}

function UserPanel({ user, orgs, groups, isSelf, canGrantAssistant, onClose }: { user: EditableUser | null; orgs: OrgOption[]; groups: OrgOption[]; isSelf: boolean; canGrantAssistant: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[520px]">
        {user && (
          <form key={user.id} className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await updateUser(user.id, fd); toast.success("Saved"); onClose(); router.refresh(); } catch (err) { toastError(err); } }); }}>
            <DialogHeader className="border-b border-border px-6 py-5 text-left">
              <div className="flex items-center gap-3"><UserAvatar initials={user.initials} src={user.avatar} size={40} /><div><DialogTitle className="text-lg">{user.name}</DialogTitle><DialogDescription>{user.email}</DialogDescription></div></div>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
              {user.status === "disabled" && <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-muted-foreground">Access is turned off. {user.name.split(" ")[0]} cannot open the app. Their organizations, role and groups are kept, so enabling them restores everything.</p>}
              <Field label="Role" hint="Core Admins approve access, manage people and can delete any event.">
                <ChoiceChips name="role" defaultValue={user.role} options={[{ value: "member", label: "Member" }, { value: "core_admin", label: "Core Admin" }]} />
              </Field>
              <Field label="Can approve designs for" hint="Gets notified when designs are sent for review, and can approve, request changes and reopen, in these organizations only. Leave empty for none; only organizations they belong to count.">
                <ChoiceChips name="approver_org" multiple defaultValue={user.approverOrgIds} options={orgs.map((o) => ({ value: o.id, label: o.label }))} />
              </Field>
              <GlossaryRow defaultOn={user.glossarySteward} />
              {canGrantAssistant && <SwitchRow name="assistant_enabled" label="Assistant" hint="Can talk or type to the assistant to draft projects, formats and comments. Only you can switch this on." defaultOn={!!user.assistant} />}
              <Field label="Function" hint="Routes notifications. Designers and Core Admins can edit the format catalog.">
                <ChoiceChips name="tag" multiple defaultValue={user.function_tags} options={TAGS} />
              </Field>
              <Field label="Organizations" hint="Decides which events they can see.">
                <ChoiceChips name="org" multiple defaultValue={user.orgIds} options={orgs.map((o) => ({ value: o.id, label: o.label }))} />
              </Field>
              {groups.length > 0 && (
                <Field label="Groups" hint="Decides which chat channels their posts go to. Manage groups in the Groups tab.">
                  <input type="hidden" name="groups_present" value="1" />
                  <ChoiceChips name="group" multiple defaultValue={user.groupIds ?? []} options={groups.map((g) => ({ value: g.id, label: g.label }))} />
                </Field>
              )}
              <HideRow defaultOn={!!user.hideInLists} />
              <Field label="Chat mentions" hint="So Slack and Google Chat posts can ping them. Slack: their profile → ⋮ → Copy member ID. Google Chat fills itself in when they sign in.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm"><span className="text-muted-foreground">Slack member ID</span><Input name="slack_user_id" defaultValue={user.slack_user_id ?? ""} placeholder="U0123ABCD" autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" /></label>
                  <label className="space-y-1.5 text-sm"><span className="text-muted-foreground">Google Chat user ID</span><Input name="gchat_user_id" defaultValue={user.gchat_user_id ?? ""} placeholder={user.gchat_user_id ? "" : "Set on their next sign-in"} inputMode="numeric" className="font-mono" /></label>
                </div>
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              {!isSelf ? (
                <div className="flex items-center gap-1">
                  {user.status === "disabled"
                    ? <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => { try { await enableUser(user.id); toast.success(`${user.name} can use the app again`); onClose(); router.refresh(); } catch (err) { toastError(err); } })}>Enable user</Button>
                    : <ConfirmButton variant="ghost" label="Disable user" title={`Turn off ${user.name}'s access?`} description={`${user.name.split(" ")[0]} will not be able to open the app, and will not appear in any list. Their comments and uploads stay, with their name. Their organizations, role and groups are kept, so you can enable them again at any time and everything comes back. If they are the only approver in an organization, designs there cannot be approved until someone else is.`} confirmLabel="Disable user" action={async () => { await disableUser(user.id); onClose(); }} />}
                  <ConfirmButton variant="ghost" label="Remove" title={`Remove ${user.name}?`} description="They lose access immediately and their organizations are cleared; adding them back later means setting everything up again. Their comments and uploads stay. To switch someone off for a while, use Disable user instead." confirmLabel="Remove" action={async () => { await removeUser(user.id); onClose(); }} />
                </div>
              ) : <span />}
              <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HideRow({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
      <input type="hidden" name="hide_in_lists" value={on ? "on" : "off"} />
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
      <span><span className="block text-sm font-medium">Hide from lists</span><span className="block text-sm text-muted-foreground">They keep full access, and their name still shows on what they create, upload or comment on. They are left out when someone types @, picks a designer or adds people to a project.</span></span>
    </label>
  );
}

function GlossaryRow({ defaultOn }: { defaultOn: boolean }) {
  return <SwitchRow name="glossary_steward" label="Glossary steward" hint="Can add, edit, delete and import words in the Glossary, in either organization. Everyone can read and search it." defaultOn={defaultOn} />;
}

function SwitchRow({ name, label, hint, defaultOn }: { name: string; label: string; hint: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="block text-sm text-muted-foreground">{hint}</span></span>
      <input type="hidden" name={name} value={on ? "on" : "off"} />
      <Switch checked={on} onCheckedChange={setOn} />
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-3"><div><p className="text-sm font-medium">{label}</p>{hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}</div>{children}</div>;
}
