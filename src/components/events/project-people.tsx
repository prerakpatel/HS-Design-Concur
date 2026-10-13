"use client";
// icons: group, person_add, close, link, check_circle, warning, forum

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { addProjectPerson, removeProjectPerson, connectProjectChat, disconnectProjectChat } from "@/app/actions/project-people";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import type { ProjectPerson, ChatLink } from "@/lib/project-people";

export interface ProjectPeopleProps {
  eventId: string; orgName: string;
  people: ProjectPerson[]; chat: ChatLink | null;
  /** Creator, approvers, designers and Core Admins of the organization may change the list and the chat. */
  canManage: boolean;
  /** Organization members not on the list yet, offered as suggestions while typing. */
  suggestions: { email: string; name: string }[];
  /** Slack channel links work (the app has a bot token); otherwise Slack takes a webhook. */
  slackChannels: boolean;
}

/**
 * "People" in the project header: who is on this project and where its chat goes. Adding someone from outside the
 * organization makes them a guest who sees this project only. With a chat connected, the project's updates go
 * there and never to the organization's channels.
 */
export function ProjectPeople(p: ProjectPeopleProps) {
  const guests = p.people.filter((x) => x.guest);
  const warn = guests.length > 0 && !p.chat;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Icon name="group" className="!text-[18px]" />People{p.people.length ? ` · ${p.people.length}` : ""}
          {warn && p.canManage && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning ring-2 ring-background" aria-label="Chat not connected" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>People &amp; chat</DialogTitle>
          <DialogDescription>
            {p.people.length === 0
              ? `Everyone in ${p.orgName} can open this project. Add someone from outside ${p.orgName} and they see this project only.`
              : `Guests see this project only, and only the people listed here. Everyone in ${p.orgName} can still open it.`}
          </DialogDescription>
        </DialogHeader>
        {warn && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <Icon name="warning" className="mt-px !text-[18px]" />
            <span>This project posts to the main channels, and {guests.length === 1 ? "its guest isn't" : "its guests aren't"} in them. Connect a project chat below; until then guests only get updates in the app and by email.</span>
          </p>
        )}
        {p.canManage && <AddPerson eventId={p.eventId} first={p.people.length === 0} suggestions={p.suggestions} />}
        {p.people.length > 0 && <PeopleList eventId={p.eventId} people={p.people} canManage={p.canManage} />}
        <ChatSection eventId={p.eventId} chat={p.chat} canManage={p.canManage} slackChannels={p.slackChannels} />
        <CopyLink eventId={p.eventId} />
      </DialogContent>
    </Dialog>
  );
}

function AddPerson({ eventId, first, suggestions }: { eventId: string; first: boolean; suggestions: { email: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    try { const r = await addProjectPerson(eventId, email); setEmail(""); toast.success(r.chat ? "Added. They were told in the project's chat." : "Added. Send them the project link (below) until a chat is connected."); }
    catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (email.trim()) submit(); }}>
      <div className="flex gap-2">
        <Input type="email" inputMode="email" autoComplete="off" list={`people-${eventId}`} placeholder="Add by email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" className="h-10" />
        <datalist id={`people-${eventId}`}>{suggestions.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}</datalist>
        <Button type="submit" disabled={pending || !email.trim()} className="h-10 shrink-0"><Icon name="person_add" className="!text-[18px]" />{pending ? "Adding…" : "Add"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {first ? "The first person you add also lists this organization's approvers and Core Admins. Remove anyone who doesn't need to be here; one approver stays. " : ""}
        Guests sign in with Google using this email.
      </p>
    </form>
  );
}

function PeopleList({ eventId, people, canManage }: { eventId: string; people: ProjectPerson[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const approvers = people.filter((x) => x.approver).length;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {people.map((x) => {
        const tags = [x.creator && "Created it", x.approver && "Approver", x.assigned && "Designer", x.guest && "Guest", !x.signedIn && "Hasn't signed in yet"].filter(Boolean) as string[];
        const lastApprover = x.approver && approvers <= 1;
        return (
          <li key={x.email} className="flex items-center gap-3 px-3 py-2.5">
            <UserAvatar initials={x.initials} src={x.avatar} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{x.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{[x.email, ...tags].join(" · ")}</span>
            </span>
            {canManage && x.listed && (
              <Button type="button" variant="ghost" size="icon-sm" disabled={pending || lastApprover} title={lastApprover ? "One approver stays on the project" : `Remove ${x.name}`} aria-label={`Remove ${x.name}`}
                onClick={() => start(async () => { try { await removeProjectPerson(eventId, x.email); } catch (e) { toast.error(errorMessage(e)); } })}>
                <Icon name="close" className="!text-[18px]" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const STEPS: Record<"slack" | "slackHook" | "gchat", string[]> = {
  slack: ["In the Slack channel, type /invite @Design & Concur and send it.", "Right-click the channel's name → Copy link.", "Paste the link here."],
  slackHook: ["In the Design & Concur Slack app (api.slack.com/apps), open Incoming Webhooks → Add New Webhook → pick the channel.", "Copy the webhook URL.", "Paste it here."],
  gchat: ["In the Google Chat space, click the space's name → Apps & integrations → Webhooks.", "Add webhook, name it Design & Concur, Save.", "Copy the link and paste it here."],
};

function ChatSection({ eventId, chat, canManage, slackChannels }: { eventId: string; chat: ChatLink | null; canManage: boolean; slackChannels: boolean }) {
  const [platform, setPlatform] = useState<"slack" | "gchat">("slack");
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  if (chat) return (
    <section className="flex items-center gap-3 rounded-xl bg-subtle px-4 py-3">
      <Icon name="check_circle" className="text-success-text" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Posting to {chat.label ?? (chat.platform === "gchat" ? "a Google Chat space" : "a Slack channel")}</span>
        <span className="block text-xs text-muted-foreground">This project&rsquo;s updates go only here, never to the main channels.</span>
      </span>
      {canManage && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { try { await disconnectProjectChat(eventId); } catch (e) { toast.error(errorMessage(e)); } })}>Disconnect</Button>}
    </section>
  );
  if (!canManage) return <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-muted-foreground">This project posts to the main channels.</p>;
  const steps = platform === "gchat" ? STEPS.gchat : slackChannels ? STEPS.slack : STEPS.slackHook;
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-medium"><Icon name="forum" className="!text-[18px]" />Project chat</h3>
        <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium" role="tablist">
          {(["slack", "gchat"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={platform === k} onClick={() => setPlatform(k)} className={cn("rounded-md px-2.5 py-1 transition-colors", platform === k ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>{k === "slack" ? "Slack" : "Google Chat"}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Without one, this project posts to the main channels. Create a {platform === "gchat" ? "space" : "channel"} with everyone listed above and connect it: from then on its updates go only there. Disconnect it and they go back to the main channels.</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { try { await connectProjectChat(eventId, link); setLink(""); toast.success("Connected. A hello was posted there."); } catch (err) { toast.error(errorMessage(err)); } }); }}>
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={platform === "gchat" ? "https://chat.googleapis.com/…" : slackChannels ? "https://…slack.com/archives/C…" : "https://hooks.slack.com/services/…"} aria-label="Chat link" className="h-10" />
        <Button type="submit" disabled={pending || !link.trim()} className="h-10 shrink-0">{pending ? "Connecting…" : "Connect"}</Button>
      </form>
    </section>
  );
}

function CopyLink({ eventId }: { eventId: string }) {
  return (
    <Button type="button" variant="ghost" className="justify-self-start" onClick={async () => {
      try { await navigator.clipboard.writeText(`${window.location.origin}/events/${eventId}`); toast.success("Project link copied"); } catch { toast.error("Couldn't copy. Copy the address bar instead."); }
    }}><Icon name="link" className="!text-[18px]" />Copy project link</Button>
  );
}
