import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RELEASES } from "@/config/changelog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { EventList } from "@/components/events/event-list";
import { BriefCard, ActivityFeed } from "@/components/events/event-detail";
import { FormatGrid } from "@/components/events/format-grid";
import { UsersList } from "@/components/settings/user-editor";
import { AccessRequests } from "@/components/settings/access-requests";
import { FormatsList } from "@/components/settings/format-editor";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { EventForm, FormatsForm, AssignForm, ReviewPanel } from "@/components/wizard/steps";
import { AssetStage } from "@/components/asset/asset-stage";
import { AssetHeader } from "@/components/asset/asset-header";
import { ReviewActions } from "@/components/asset/review-actions";
import { relativeTime } from "@/lib/labels";
import { PushToggle } from "@/components/push-toggle";
import { ProfileView } from "@/components/profile-view";
import { noop, noopForm, noopUser } from "@/app/preview/actions";
import * as F from "@/lib/fixtures";

export const dynamic = "force-dynamic";
const SCREENS = ["events", "event", "slot", "profile", "settings", "requests", "formats", "inbox", "wizard-new", "wizard-event", "wizard-formats", "wizard-assign", "wizard-review"] as const;

/** Design preview harness. Renders real components with fixture data so screens can be reviewed without a database. */
export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.DESIGN_PREVIEW !== "1") notFound();
  const { screen } = await params;
  if (!SCREENS.includes(screen as (typeof SCREENS)[number])) notFound();
  const org = F.ORGS[0];
  const shell = (children: React.ReactNode, wide?: boolean) => <AppShell org={org} orgs={F.ORGS} user={F.ME} slots={F.SLOTS} wide={wide} changelog={{ releases: RELEASES, unseen: false, canShare: true, sharedIds: [] }}>{children}</AppShell>;
  const tabs = (items: [string, string, number?][], active: string) => (
    <nav className="mb-6 flex gap-6 border-b border-border text-sm font-medium">
      {items.map(([k, l, n]) => <span key={k} className={"-mb-px flex items-center gap-2 border-b-2 pb-3 " + (active === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground")}>{l}{n != null && <span className="text-sm font-normal text-muted-foreground">{n}</span>}</span>)}
    </nav>
  );

  if (screen === "events") return shell(<>
    <PageHeader title="Events" subtitle={`${org.name} · 4 of 10 event slots in use`} actions={<Button asChild><Link href="#">New event</Link></Button>} />
    {tabs([["upcoming", "Upcoming", 3], ["drafts", "Drafts", 1], ["past", "Past", 0]], "upcoming")}
    <EventList items={F.EVENTS.filter((e) => e.status === "active")} />
  </>);

  if (screen === "event") { const req = F.CARDS.filter((c) => c.requested); const ok = req.filter((c) => c.state === "approved").length; return shell(<>
    <PageHeader back={<Link href="#" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrow_back" className="!text-[18px]" />Events</Link>} title="Diwali Annakut Darshan" subtitle="Sun 8 Nov 2026 · Harisumiran Mandir, Edison · Created by Rina Desai" actions={<Button asChild variant="secondary"><Link href="#">Edit event</Link></Button>} />
    <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
      <div className="space-y-10">
        <BriefCard brief={{ ...F.BRIEF_VIEW, inviteText: F.BRIEF }} locked editHref="#" />
        <FormatGrid eventId="e-1" cards={F.CARDS} canApprove meta={`${ok} approved · ${req.length - ok} in progress · ${F.CARDS.length - req.length} N/A`} />
      </div>
      <ActivityFeed items={F.ACTIVITY} />
    </div>
  </>); }

  if (screen === "slot") return shell(<div className="pb-8 max-md:pb-24">
    <AssetHeader eventId="e-1" eventTitle="Diwali Annakut Darshan" formatName="WhatsApp flyer" position={{ at: 3, total: 6 }} prev={{ id: "s-2", name: "Instagram story" }} next={{ id: "s-4", name: "Lobby TV" }} />
    <div className="mx-auto max-w-[1440px] px-4 pt-4 md:px-6 md:pt-6">
      <AssetStage versionId="v-1" sides={[{ side: "front", src: "/preview/flyer.webp", isGif: false, width: 1080, height: 1350 }]} safe={{ top: 90, right: 60, bottom: 110, left: 60 }} print={{ bleedIn: 0.125, safeIn: 0.25, widthIn: 5, heightIn: 6.25 }} comments={F.COMMENTS} members={F.MEMBERS} canComment canModerate
        versions={[{ id: "v-1", number: 1, decision: "changes_requested", canManage: true, hasBack: false }]} currentVersionId="v-1" eventId="e-1" slotId="s-3" upload={{ accept: ["image/png", "image/jpeg", "image/webp"], isPrint: false, nextNumber: 2 }} readOnly={false}
        status={{ state: "changes_requested", version: 1, uploader: "Kinjal Patel", uploadedAt: F.COMMENTS[0].created_at }}
        decision={<ReviewActions versionId="v-1" label="WhatsApp flyer v1" eventTitle="Diwali Annakut Darshan" decision="changes_requested" canApprove isOwnUpload={false} hasBack={false} layout="fill" />}
        decisionBar={<ReviewActions versionId="v-1" label="WhatsApp flyer v1" eventTitle="Diwali Annakut Darshan" decision="changes_requested" canApprove isOwnUpload={false} hasBack={false} />} />
    </div>
  </div>);

  if (screen === "profile") return shell(<><PageHeader title="Profile" /><ProfileView user={{ name: F.ME.name, email: "prerak@harisumiran.org", roles: F.ME.role.split(" · "), initials: F.ME.initials, slackId: null, gchatLinked: true }} orgs={F.ORGS} currentOrgId={org.id} /></>);

  if (screen === "settings" || screen === "requests" || screen === "formats") return shell(<>
    <PageHeader title="Settings" subtitle="People, access, the format catalog and notifications" />
    {tabs([["users", "Users"], ["requests", "Requests · 2"], ["formats", "Formats"], ["notifications", "Notifications"]], screen === "settings" ? "users" : screen)}
    {screen === "formats" ? <FormatsList formats={F.FORMATS} /> : screen === "settings" ? <UsersList currentUserId="u-1" orgs={F.ORGS.map((o) => ({ id: o.id, label: o.short_name }))} users={F.USERS.map((u) => ({ ...u, email_pref: F.USERS_PREFS[u.id] }))} /> : <AccessRequests action={noopUser} orgs={F.ORGS.map((o) => ({ id: o.id, label: o.short_name }))} defaultOrgId={org.id} pending={F.PENDING} />}
  </>);

  if (screen === "inbox") return shell(<>
    <PageHeader title="Inbox" subtitle="2 unread" actions={<Button variant="secondary">Mark all read</Button>} />
    <div className="mb-8 space-y-3">
    <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
    </div>
    <ul className="divide-y divide-border">{F.INBOX.map(([icon, text, at, read], i) => <li key={i}><Link href="#" className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 hover:bg-subtle"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name={icon} size={20} /></span><span className="min-w-0 flex-1"><span className={"block text-sm leading-6 " + (read ? "" : "font-medium")}>{text}</span><span className="block text-sm text-muted-foreground">Diwali Annakut Darshan · {relativeTime(at)}</span></span>{!read && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}</Link></li>)}</ul>
  </>);

  const eventValues = { title: "Diwali Annakut Darshan", event_date: "2026-11-08", time_text: "5:30 PM onwards\nAarti at 7 PM", description: "Join us for Annakut Darshan…", venue_name: "Harisumiran NJ", venue_address: "2 Lincoln Ave, Lake Hiawatha, NJ 07034", notes: "" };
  if (screen === "wizard-new") return <WizardShell eventId={null} step="event" title="Tell us about the event" subtitle="The basics and the words that go on the designs. Anyone in Harisumiran can pick this up later if you save and exit."><EventForm eventId={null} orgName="Harisumiran" values={{ ...eventValues, title: "", event_date: "", time_text: "", description: "" }} action={noop} /></WizardShell>;
  if (screen === "wizard-event") return <WizardShell eventId="e-4" step="event" statuses={{ event: "done" }} title="Tell us about the event" subtitle="The basics and exactly the words the designers will place."><EventForm eventId="e-4" orgName="Harisumiran" values={eventValues} action={noop} /></WizardShell>;
  if (screen === "wizard-formats") return <WizardShell eventId="e-4" step="formats" statuses={{ event: "incomplete" }} title="Which formats does this event need?" subtitle="All formats start off. Turn on the ones you need." wide><FormatsForm eventId="e-4" rows={F.FORMAT_ROWS} action={noopForm} /></WizardShell>;
  if (screen === "wizard-assign") return <WizardShell eventId="e-4" step="assign" title="Who designs what, and by when?" subtitle="Designers are listed first. Due dates send a reminder three days before and on the day." wide><AssignForm eventId="e-4" rows={F.ASSIGN_ROWS} people={F.PEOPLE} action={noopForm} /></WizardShell>;
  return <WizardShell eventId="e-4" step="review" statuses={{ event: "incomplete", formats: "done", assign: "incomplete" }} title="Ready to publish?" subtitle="Publishing takes one of the shared event slots and notifies the assigned designers."><ReviewPanel eventId="e-4" isDraft canDelete issues={[{ text: "The invite text is missing.", step: "event", blocking: true }, { text: "2 of 6 formats have no designer yet.", step: "assign", blocking: false }]} summary={{ title: "Diwali Annakut Darshan", when: "Sun 8 Nov 2026", venue: "Harisumiran Mandir, Edison", brief: F.BRIEF }} slots={F.CARDS.filter((c) => c.requested).map((c) => ({ name: c.name, assignee: c.assignee, due: c.due }))} publish={noop} remove={noop} /></WizardShell>;
}
