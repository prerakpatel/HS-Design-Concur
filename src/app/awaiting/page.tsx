import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";

export const metadata = { title: "Awaiting access" };

export default async function AwaitingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.status === "active" && session.orgs.length > 0) redirect("/events");
  const removed = session.user.status === "removed";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-subtle p-6">
      <div className="w-full max-w-[460px] rounded-3xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted"><Icon name={removed ? "block" : "hourglass_top"} size={24} /></div>
        <h1 className="mt-6 text-[30px] font-semibold leading-9 tracking-[-0.015em]">{removed ? "Access removed" : "You are on the list"}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {removed ? "A Core Admin removed your access. Contact them if you think this is a mistake." : "A Core Admin will review your request and pick which organisation you belong to. You will get an email when you are in."}
        </p>
        <p className="mt-6 text-xs text-muted-foreground">Signed in as {session.user.email}</p>
        <form action={signOut} className="mt-4"><Button variant="ghost" type="submit">Sign out</Button></form>
      </div>
    </main>
  );
}
