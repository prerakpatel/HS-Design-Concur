"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { UserAvatar } from "@/components/user-avatar";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { updateUser, removeUser } from "@/app/actions/admin";

export interface EditableUser { id: string; name: string; email: string; initials: string; avatar?: string | null; role: "member" | "core_admin"; is_approver: boolean; function_tags: string[]; orgIds: string[]; email_pref?: "instant" | "digest" | "off" }
export interface OrgOption { id: string; label: string }
const TAGS = [{ value: "central", label: "Central" }, { value: "publication", label: "Publication" }, { value: "designer", label: "Designer" }];
const tagLabel = (t: string) => TAGS.find((x) => x.value === t)?.label ?? t;

/** Users list: one calm row per person; tap opens a side sheet with the full editor. */
export function UsersList({ users, orgs, currentUserId }: { users: EditableUser[]; orgs: OrgOption[]; currentUserId: string }) {
  const [open, setOpen] = useState<EditableUser | null>(null);
  return (
    <>
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => setOpen(u)} className="-mx-3 flex w-[calc(100%+24px)] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-subtle md:gap-4">
              <UserAvatar initials={u.initials} src={u.avatar} size={36} />
              <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-5">{u.name}{u.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{u.email}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:mt-0">
                  {u.role === "core_admin" ? <StateBadge state="in_review" label="Core Admin" /> : <StateBadge state="requested" label="Member" />}
                  {(u.is_approver || u.role === "core_admin") && <StateBadge state="approved" label="Approver" />}
                  <span className="ml-1 text-[13px] text-muted-foreground md:hidden">{u.function_tags.map(tagLabel).join(" · ") || "No function"}</span>
                </div>
                <div className="hidden flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground md:flex">
                  {u.function_tags.length ? u.function_tags.map((t) => <span key={t}>{tagLabel(t)}</span>) : <span className="text-muted-foreground/70">No function</span>}
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground md:mt-0">
                  <p className="truncate">{orgs.filter((o) => u.orgIds.includes(o.id)).map((o) => o.label).join(", ") || "No org"}{u.email_pref && <span className="text-muted-foreground/80 md:hidden"> · Email {u.email_pref === "instant" ? "as it happens" : u.email_pref === "digest" ? "daily" : "off"}</span>}</p>
                  {u.email_pref && <p className="hidden truncate text-xs text-muted-foreground/80 md:block">Email {u.email_pref === "instant" ? "as it happens" : u.email_pref === "digest" ? "daily" : "off"}</p>}
                </div>
              </div>
              <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <UserPanel user={open} orgs={orgs} isSelf={open?.id === currentUserId} onClose={() => setOpen(null)} />
    </>
  );
}

function UserPanel({ user, orgs, isSelf, onClose }: { user: EditableUser | null; orgs: OrgOption[]; isSelf: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[520px]">
        {user && (
          <form key={user.id} className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await updateUser(user.id, fd); toast.success("Saved"); onClose(); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
            <DialogHeader className="border-b border-border px-6 py-5 text-left">
              <div className="flex items-center gap-3"><UserAvatar initials={user.initials} src={user.avatar} size={40} /><div><DialogTitle className="text-lg">{user.name}</DialogTitle><DialogDescription>{user.email}</DialogDescription></div></div>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <Field label="Role" hint="Core Admins approve access, manage people and can delete any event.">
                <ChoiceChips name="role" defaultValue={user.role} options={[{ value: "member", label: "Member" }, { value: "core_admin", label: "Core Admin" }]} />
              </Field>
              <ApproverRow defaultOn={user.is_approver || user.role === "core_admin"} lockedOn={user.role === "core_admin"} />
              <Field label="Function" hint="Routes notifications. Designers and Core Admins can edit the format catalog.">
                <ChoiceChips name="tag" multiple defaultValue={user.function_tags} options={TAGS} />
              </Field>
              <Field label="Organisations" hint="Decides which events they can see.">
                <ChoiceChips name="org" multiple defaultValue={user.orgIds} options={orgs.map((o) => ({ value: o.id, label: o.label }))} />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              {!isSelf ? <ConfirmButton variant="ghost" label="Remove" title={`Remove ${user.name}?`} description="They lose access immediately. Their comments and uploads stay." confirmLabel="Remove" action={async () => { await removeUser(user.id); onClose(); }} /> : <span />}
              <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApproverRow({ defaultOn, lockedOn }: { defaultOn: boolean; lockedOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
      <span><span className="block text-sm font-medium">Can approve designs</span><span className="block text-sm text-muted-foreground">{lockedOn ? "Core Admins always can." : "Approvers sign off, request changes and reopen."}</span></span>
      <input type="hidden" name="is_approver" value={on ? "on" : "off"} />
      <Switch checked={lockedOn || on} onCheckedChange={setOn} disabled={lockedOn} />
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-3"><div><p className="text-sm font-medium">{label}</p>{hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}</div>{children}</div>;
}
