"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { UserAvatar } from "@/components/user-avatar";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { updateUser, removeUser } from "@/app/actions/admin";

export interface EditableUser { id: string; name: string; email: string; initials: string; role: "member" | "core_admin"; is_approver: boolean; function_tags: string[]; orgIds: string[] }
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
            <button type="button" onClick={() => setOpen(u)} className="-mx-3 flex w-[calc(100%+24px)] items-center gap-4 rounded-2xl px-3 py-4 text-left transition-colors hover:bg-subtle">
              <UserAvatar initials={u.initials} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-5">{u.name}{u.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>}</p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">{[u.role === "core_admin" ? "Core Admin" : u.is_approver ? "Approver" : null, ...u.function_tags.map(tagLabel), orgs.filter((o) => u.orgIds.includes(o.id)).map((o) => o.label).join(", ")].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="hidden flex-wrap items-center justify-end gap-1.5 md:flex">
                {u.role === "core_admin" ? <StateBadge state="in_review" label="Core Admin" /> : u.is_approver ? <StateBadge state="approved" label="Approver" /> : null}
                {u.function_tags.map((t) => <StateBadge key={t} state="requested" label={tagLabel(t)} />)}
                {orgs.filter((o) => u.orgIds.includes(o.id)).map((o) => <span key={o.id} className="text-xs text-muted-foreground">{o.label}</span>)}
              </div>
              <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <UserSheet user={open} orgs={orgs} isSelf={open?.id === currentUserId} onClose={() => setOpen(null)} />
    </>
  );
}

function UserSheet({ user, orgs, isSelf, onClose }: { user: EditableUser | null; orgs: OrgOption[]; isSelf: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[460px]">
        {user && (
          <form key={user.id} className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await updateUser(user.id, fd); toast.success("Saved"); onClose(); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
            <SheetHeader className="px-6 pt-6">
              <div className="flex items-center gap-3"><UserAvatar initials={user.initials} size={40} /><div><SheetTitle className="text-lg">{user.name}</SheetTitle><SheetDescription>{user.email}</SheetDescription></div></div>
            </SheetHeader>
            <div className="flex-1 space-y-8 px-6 py-6">
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
      </SheetContent>
    </Sheet>
  );
}

function ApproverRow({ defaultOn, lockedOn }: { defaultOn: boolean; lockedOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
      <span><span className="block text-[15px] font-medium">Can approve designs</span><span className="block text-sm text-muted-foreground">{lockedOn ? "Core Admins always can." : "Approvers sign off, request changes and reopen."}</span></span>
      <input type="hidden" name="is_approver" value={on ? "on" : "off"} />
      <Switch checked={lockedOn || on} onCheckedChange={setOn} disabled={lockedOn} />
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-3"><div><p className="text-[15px] font-medium">{label}</p>{hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}</div>{children}</div>;
}
