import type { Organisation } from "@/lib/types";
import type { EventListItem } from "@/components/events/event-list";
import type { FormatCardData, ActivityItem } from "@/components/events/event-detail";
import type { EditableUser } from "@/components/settings/user-editor";
import type { PendingUser } from "@/components/settings/access-requests";
import type { CommentView, Member } from "@/components/asset/comments";
import type { FormatRow, AssignRow, Person } from "@/components/wizard/steps";

/** Static fixtures for the /preview design harness. Not used by the app. */
export const ORGS: Organisation[] = [
  { id: "org-hs", slug: "harisumiran", name: "Harisumiran", short_name: "Harisumiran", accepting_signups: true, email_enabled: true, chat_enabled: false, chat_webhook_url: null },
  { id: "org-acc", slug: "acc", name: "Atmiya Care Charities", short_name: "ACC", accepting_signups: true, email_enabled: true, chat_enabled: true, chat_webhook_url: null },
];
export const ME = { id: "u-1", name: "Prerak Patel", role: "Core Admin · Approver", initials: "PP" };
export const SLOTS = { used: 4, max: 10 };
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const EVENTS: EventListItem[] = [
  { id: "e-1", title: "Diwali Annakut Darshan", venue: "Harisumiran Mandir, Edison", event_date: "2026-11-08", status: "active", approved: 2, total: 6, people: ["MS", "KP"], needsYou: true },
  { id: "e-2", title: "Sharad Purnima Utsav", venue: "Main Hall", event_date: "2026-10-06", status: "active", approved: 5, total: 5, people: ["MS"] },
  { id: "e-3", title: "Youth Shibir 2026", venue: "Community Center, Piscataway", event_date: "2026-12-19", status: "active", approved: 0, total: 4, people: ["KP", "RD"] },
  { id: "e-4", title: "New Year Mahotsav", venue: null, event_date: "2027-01-01", status: "draft", approved: 0, total: 0, people: [] },
];

export const CARDS: FormatCardData[] = [
  { slotId: "s-1", name: "Instagram post", size: "1080 × 1080 px", state: "approved", requested: true, version: 3, thumb: "/preview/flyer.webp", due: "2026-10-20", assignee: { name: "Mihir Shah", initials: "MS" } },
  { slotId: "s-2", name: "Instagram story", size: "1080 × 1920 px", state: "in_review", requested: true, version: 2, thumb: "/preview/flyer.webp", due: "2026-10-20", assignee: { name: "Mihir Shah", initials: "MS" } },
  { slotId: "s-3", name: "WhatsApp flyer", size: "1080 × 1350 px", state: "changes_requested", requested: true, version: 1, thumb: "/preview/flyer.webp", due: "2026-10-22", assignee: { name: "Kinjal Patel", initials: "KP" } },
  { slotId: "s-4", name: "Lobby TV", size: "1920 × 1080 px", state: "requested", requested: true, version: null, thumb: null, due: "2026-10-25", assignee: { name: "Kinjal Patel", initials: "KP" } },
  { slotId: "s-5", name: "LED wall", size: "3840 × 1152 px", state: "requested", requested: true, version: null, thumb: null, due: null, assignee: null },
  { slotId: "s-6", name: "Print flyer", size: "8.5 × 11 in · 300 dpi", state: "approved", requested: true, version: 1, thumb: "/preview/flyer.webp", due: "2026-10-18", assignee: { name: "Mihir Shah", initials: "MS" } },
  { slotId: "s-7", name: "Banner 6 × 3 ft", size: "72 × 36 in", state: "requested", requested: false, version: null, thumb: null, due: null, assignee: null },
  { slotId: "s-8", name: "Email header", size: "1200 × 400 px", state: "requested", requested: false, version: null, thumb: null, due: null, assignee: null },
];

export const ACTIVITY: ActivityItem[] = [
  { id: 1, who: "Mihir Shah", initials: "MS", what: "uploaded Instagram story v2", when: ago(2) },
  { id: 2, who: "Prerak Patel", initials: "PP", what: "requested changes on WhatsApp flyer v1", when: ago(26) },
  { id: 3, who: "Prerak Patel", initials: "PP", what: "approved Instagram post v3", when: ago(30) },
  { id: 4, who: "Rina Desai", initials: "RD", what: "published the event", when: ago(120) },
];

export const TIMINGS = [{ label: "Annakut darshan", when: "Sun 8 Nov · 10:00–13:00" }, { label: "Aarti", when: "Sun 8 Nov · 18:30" }];
export const BRIEF = "Annual Annakut darshan with over 1,000 food items offered to Thakorji. Invite families to darshan and evening aarti. Highlight free parking and the youth volunteer sign-up. Bilingual (English + Gujarati) where the format allows.";

export const USERS: EditableUser[] = [
  { id: "u-1", name: "Prerak Patel", email: "prerak@harisumiran.org", initials: "PP", role: "core_admin", is_approver: true, function_tags: ["central"], orgIds: ["org-hs", "org-acc"] },
  { id: "u-2", name: "Mihir Shah", email: "mihir.shah@gmail.com", initials: "MS", role: "member", is_approver: false, function_tags: ["designer"], orgIds: ["org-hs"] },
  { id: "u-3", name: "Kinjal Patel", email: "kinjal.p@gmail.com", initials: "KP", role: "member", is_approver: false, function_tags: ["designer", "publication"], orgIds: ["org-hs", "org-acc"] },
  { id: "u-4", name: "Rina Desai", email: "rina.desai@gmail.com", initials: "RD", role: "member", is_approver: true, function_tags: ["publication"], orgIds: ["org-hs"] },
  { id: "u-5", name: "Amit Joshi", email: "amit.joshi@gmail.com", initials: "AJ", role: "member", is_approver: false, function_tags: [], orgIds: ["org-acc"] },
];
export const PENDING: PendingUser[] = [
  { id: "p-1", name: "Neha Trivedi", email: "neha.trivedi@gmail.com", initials: "NT", requested_at: ago(5) },
  { id: "p-2", name: "Sanjay Mehta", email: "sanjay.m@outlook.com", initials: "SM", requested_at: ago(50) },
];

export const COMMENTS: CommentView[] = [
  { id: "c-1", body: "Logo is too close to the bottom edge, move it inside the safe area.", created_at: ago(26), pin_x: 0.5, pin_y: 0.93, addressed_at: null, confirmed_at: null, author: { name: "Prerak Patel", initials: "PP", role: "Core Admin" } },
  { id: "c-2", body: "@mihir can we try the Gujarati headline in the brand red?", created_at: ago(20), pin_x: null, pin_y: null, addressed_at: ago(4), confirmed_at: null, author: { name: "Rina Desai", initials: "RD", role: "Approver" } },
];
export const INBOX = [["assignment_ind", "Rina Desai assigned you Lobby TV", ago(2), false], ["alternate_email", "Rina Desai mentioned you on WhatsApp flyer v1", ago(20), false], ["check_circle", "Prerak Patel approved Instagram post v3", ago(30), true], ["schedule", "Instagram story is due in 3 days", ago(50), true]] as const;
export const MEMBERS: Member[] = USERS.map((u) => ({ id: u.id, name: u.name, handle: u.email.split("@")[0].toLowerCase() }));

export const FORMAT_ROWS: FormatRow[] = CARDS.map((c) => ({ slotId: c.slotId, name: c.name, size: c.size, kind: c.name.startsWith("Print") || c.name.startsWith("Banner") ? "print" : "digital", requested: c.requested, notes: c.slotId === "s-3" ? "Gujarati headline" : "", customSize: c.slotId === "s-5", w: c.slotId === "s-5" ? 3840 : null, h: c.slotId === "s-5" ? 1152 : null }));
export const ASSIGN_ROWS: AssignRow[] = CARDS.filter((c) => c.requested).map((c) => ({ slotId: c.slotId, name: c.name, assignee: c.assignee?.name === "Mihir Shah" ? "u-2" : c.assignee ? "u-3" : "", due: c.due ?? "" }));
export const PEOPLE: Person[] = [{ id: "u-2", label: "Mihir Shah · Designer" }, { id: "u-3", label: "Kinjal Patel · Designer" }, { id: "u-1", label: "Prerak Patel" }, { id: "u-4", label: "Rina Desai" }];
