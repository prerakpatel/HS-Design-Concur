import type { NotificationKind } from "@/lib/notify";

/**
 * Master switch for the daily job's personal reminders (due soon, waiting uploads, open changes, designs awaiting
 * review). Paused for now: set to true to bring them back. Each person can still switch them off or snooze them.
 */
export const PERSONAL_REMINDERS_ENABLED = false;
/** A person is reminded at most this often (days). */
export const REMINDER_EVERY_DAYS = 2;
/** Chat kinds about comments; every other chat kind is a project update. Each has its own organisation switch. */
export const COMMENT_CHAT_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>(["comment.mention", "comment.posted", "comments.posted", "changes.requested", "version.changes_requested"]);
