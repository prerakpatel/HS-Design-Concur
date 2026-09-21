import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { StateBadge } from "@/components/state-badge";
import { SelectField } from "@/components/ui/select-field";
import { EventList } from "@/components/events/event-list";
import { BriefCard, FormatGrid, ActivityFeed } from "@/components/events/event-detail";
import { UsersList } from "@/components/settings/user-editor";
import { AccessRequests } from "@/components/settings/access-requests";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { BasicsForm, BriefForm, FormatsForm, AssignForm, ReviewPanel } from "@/components/wizard/steps";
import { CommentsPanel } from "@/components/asset/comments";
import { ReviewActions } from "@/components/asset/review-actions";
import { UploadPanel } from "@/components/asset/upload-panel";
import { relativeTime } from "@/lib/labels";
import { noop, noopForm, noopUser } from "@/app/preview/actions";
import * as F from "@/lib/fixtures";

export const dynamic = "force-dynamic";
const SCREENS = ["events", "event", "slot", "settings", "requests", "inbox", "wizard-basics", "wizard-brief", "wizard-formats", "wizard-assign", "wizard-review"] as const;

/** Design preview harness. Renders real components with fixture data so screens can be reviewed without a database. */
export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.DESIGN_PREVIEW !== "1") notFound();
  const { screen } = await params;
  if (!SCREENS.includes(screen as (typeof SCREENS)[number])) notFound();
  const org = F.ORGS[0];
  const shell = (children: React.ReactNode, wide?: boolean) => <AppShell org={org} orgs={F.ORGS} user={F.ME} slots={F.SLOTS} wide={wide}>{children}</AppShell>;
  const tabs = (items: [string, string, number?][], active: string) => (
    <nav className="mb-6 flex gap-6 border-b border-border text-[15px] font-medium">
      {items.map(([k, l, n]) => <span key={k} className={"-mb-px flex items-center gap-2 border-b-2 pb-3 " + (active === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground")}>{l}{n != null && <span className="text-sm font-normal text-muted-foreground">{n}</span>}</span>)}
    </nav>
  );

  if (screen === "events") return shell(<>
    <PageHeader title="Events" subtitle={`${org.name} · 4 of 10 event slots in use`} actions={<Button asChild size="lg"><Link href="#">New event</Link></Button>} />
    {tabs([["upcoming", "Upcoming", 3], ["drafts", "Drafts", 1], ["past", "Past", 0]], "upcoming")}
    <EventList items={F.EVENTS.filter((e) => e.status === "active")} />
  </>);

  if (screen === "event") { const req = F.CARDS.filter((c) => c.requested); const ok = req.filter((c) => c.state === "approved").length; return shell(<>
    <PageHeader back={<Link href="#" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrow_back" className="!text-[18px]" />Events</Link>} title="Diwali Annakut Darshan" subtitle="Sun 8 Nov 2026 · Harisumiran Mandir, Edison · Created by Rina Desai" actions={<Button asChild variant="secondary"><Link href="#">Edit event</Link></Button>} />
    <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
      <div className="space-y-10">
        <BriefCard description={F.BRIEF} timings={F.TIMINGS} venue="Harisumiran Mandir, 1 Temple Way, Edison NJ" notes="Keep the sponsor line small. Avoid purple." locked editHref="#" />
        <section><SectionHeader title="Formats" meta={`${ok} approved · ${req.length - ok} in progress · ${F.CARDS.length - req.length} N/A`} /><FormatGrid eventId="e-1" cards={F.CARDS} /></section>
      </div>
      <ActivityFeed items={F.ACTIVITY} />
    </div>
  </>); }

  if (screen === "slot") return shell(<div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0">
        <Link href="#" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrow_back" className="!text-[18px]" />Diwali Annakut Darshan</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em] md:text-[32px] md:leading-10">WhatsApp flyer</h1><StateBadge state="changes_requested" /></div>
        <p className="mt-1.5 text-[15px] text-muted-foreground">1080 × 1350 px · digital · v1 by Kinjal Patel · Gujarati headline</p>
      </div>
      <ReviewActions versionId="v-1" label="WhatsApp flyer v1" eventTitle="Diwali Annakut Darshan" decision="changes_requested" canApprove isOwnUpload={false} downloadUrl={null} />
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-full bg-muted p-1 text-sm font-medium"><span className="rounded-full bg-card px-4 py-1.5 shadow-sm">v1</span></div>
      <UploadPanel slotId="s-3" accept={["image/png", "image/jpeg", "image/webp"]} isPrint={false} nextNumber={2} compact />
    </div>
    <CommentsPanel versionId="v-1" viewer={{ src: "/preview/flyer.webp", isGif: false, width: 1080, height: 1350, safe: { top: 0.08, right: 0.06, bottom: 0.1, left: 0.06 }, caption: "DRAFT · v1 · 20 Sep 2026", frame: "flat" }} comments={F.COMMENTS} members={F.MEMBERS} canApprove canComment />
  </div>);

  if (screen === "settings" || screen === "requests") return shell(<>
    <PageHeader title="Settings" subtitle="Core Admins only" />
    {tabs([["users", "Users"], ["requests", "Requests · 2"], ["formats", "Formats"], ["notifications", "Notifications"]], screen === "settings" ? "users" : "requests")}
    {screen === "settings" ? <UsersList currentUserId="u-1" orgs={F.ORGS.map((o) => ({ id: o.id, label: o.short_name }))} users={F.USERS} /> : <AccessRequests action={noopUser} orgs={F.ORGS.map((o) => ({ id: o.id, label: o.short_name }))} defaultOrgId={org.id} pending={F.PENDING} />}
  </>);

  if (screen === "inbox") return shell(<>
    <PageHeader title="Inbox" subtitle="2 unread" actions={<Button variant="secondary">Mark all read</Button>} />
    <form className="mb-8 flex flex-col gap-3 rounded-2xl bg-subtle p-5 md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 flex-1"><p className="text-[15px] font-medium">Email me</p><p className="text-sm text-muted-foreground">Approvals, mentions, assignments and due dates. Everything always shows here too.</p></div>
      <div className="flex gap-2"><SelectField name="email_pref" defaultValue="instant" className="w-52"><option value="instant">as things happen</option><option value="digest">once a day</option><option value="off">never</option></SelectField><Button type="button" variant="secondary" size="lg">Save</Button></div>
    </form>
    <ul className="divide-y divide-border">{F.INBOX.map(([icon, text, at, read], i) => <li key={i}><Link href="#" className="-mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 hover:bg-subtle"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name={icon} size={24} /></span><span className="min-w-0 flex-1"><span className={"block text-[15px] leading-6 " + (read ? "" : "font-medium")}>{text}</span><span className="block text-sm text-muted-foreground">Diwali Annakut Darshan · {relativeTime(at)}</span></span>{!read && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}</Link></li>)}</ul>
  </>);

  if (screen === "wizard-basics") return <WizardShell eventId="e-4" step="basics" title="Tell us the basics" subtitle="Anyone in the org can pick this up later if you save and exit."><BasicsForm eventId="e-4" orgName={org.name} values={{ title: "New Year Mahotsav", event_date: "2027-01-01", venue: "" }} action={noopForm} /></WizardShell>;
  if (screen === "wizard-brief") return <WizardShell eventId="e-4" step="brief" title="What should the designs say?" subtitle="Written once by Publication or a Core Admin. It locks at the first upload; changes then go through comments."><BriefForm eventId="e-4" values={{ description: F.BRIEF, venue: "Harisumiran Mandir, Edison", notes: "" }} timings={[{ label: "Annakut darshan", on_date: "2026-11-08", starts_at: "10:00", ends_at: "13:00" }]} action={noopForm} /></WizardShell>;
  if (screen === "wizard-formats") return <WizardShell eventId="e-4" step="formats" title="Which formats does this event need?" subtitle="Mark the rest N/A. You can change this any time from the event page." wide><FormatsForm eventId="e-4" rows={F.FORMAT_ROWS} action={noopForm} /></WizardShell>;
  if (screen === "wizard-assign") return <WizardShell eventId="e-4" step="assign" title="Who designs what, and by when?" subtitle="Designers are listed first. Due dates send a reminder three days before and on the day." wide><AssignForm eventId="e-4" rows={F.ASSIGN_ROWS} people={F.PEOPLE} action={noopForm} /></WizardShell>;
  return <WizardShell eventId="e-4" step="review" title="Ready to publish?" subtitle="Publishing takes one of the shared event slots and notifies the assigned designers."><ReviewPanel eventId="e-4" isDraft canDelete problems={["Lobby TV has no due date (Assign)."]} summary={{ title: "Diwali Annakut Darshan", when: "Sun 8 Nov 2026", venue: "Harisumiran Mandir, Edison", brief: F.BRIEF }} slots={F.CARDS.filter((c) => c.requested).map((c) => ({ name: c.name, assignee: c.assignee, due: c.due }))} publish={noop} remove={noop} /></WizardShell>;
}
