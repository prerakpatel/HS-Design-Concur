import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { UserAvatar } from "@/components/user-avatar";
import { relativeTime } from "@/lib/labels";

export interface PendingUser { id: string; name: string; email: string; initials: string; requested_at: string }

export function AccessRequests({ pending, orgs, defaultOrgId, action }: { pending: PendingUser[]; orgs: { id: string; label: string }[]; defaultOrgId?: string; action: (userId: string, formData: FormData) => Promise<void> }) {
  if (pending.length === 0) return <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-[15px] text-muted-foreground">No one is waiting. New sign-ins appear here.</p>;
  return (
    <ul className="space-y-4">
      {pending.map((u) => (
        <li key={u.id}>
          <form action={action.bind(null, u.id)} className="rounded-2xl border border-border p-5 md:p-6">
            <div className="flex items-center gap-4"><UserAvatar initials={u.initials} size={40} /><div className="min-w-0 flex-1"><p className="truncate text-[15px] font-medium">{u.name}</p><p className="text-sm text-muted-foreground"><span className="break-all">{u.email}</span> · asked {relativeTime(u.requested_at)}</p></div></div>
            <div className="mt-5"><p className="text-sm font-medium">Which organisations?</p><div className="mt-2"><ChoiceChips name="org" multiple size="sm" defaultValue={defaultOrgId ? [defaultOrgId] : []} options={orgs.map((o) => ({ value: o.id, label: o.label }))} /></div></div>
            <div className="mt-5 flex justify-end gap-2"><Button type="submit" name="decision" value="deny" variant="ghost">Deny</Button><Button type="submit" name="decision" value="approve">Approve</Button></div>
          </form>
        </li>
      ))}
    </ul>
  );
}
