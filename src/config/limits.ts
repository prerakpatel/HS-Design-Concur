/** Storage and calendar limits from PRD §8. */
export const EVENT_CAP = 10;            // fallback only: each organisation sets its own cap (organisations.event_cap)
export const ASSET_MAX_DAYS = 30;       // an assets-only request ends at most this many days out; its files go at the end date
export const MONTHS_AHEAD = 6;          // an event may not be dated further out than this
export const PURGE_AFTER_DAYS = 7;      // days after the event date before it is archived and its files purged
export const DELETE_RESTORE_DAYS = 7;   // Core Admins can restore a deleted event for this long; files go after
export const DRAFT_SWEEP_DAYS = 30;     // untouched drafts are deleted after this
export const DRAFT_WARN_DAYS = 23;      // the creator is warned on this day
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const VERSIONS_KEPT = 2;         // newest versions of a format that keep their files; older ones keep only comments
export const REMINDER_LEAD_DAYS = 3;     // due-date and "ends soon" reminders go out this many days ahead (and on the day)
export const REVIEW_WAIT_HOURS = 24;   // a sent design nobody has decided on, and comments left open, are mentioned in the daily digest after this long
export const UNSENT_NUDGE_HOURS = 3;   // review-mode comments left unsent this long get a nudge
export const MAX_LOGO_BYTES = 1_000_000; // organisation logos
export const MAX_GLOSSARY_CHARS = 1_000_000; // an imported glossary file
export const CHAT_PREVIEW_DAYS = 7;      // a preview picture in a Slack / Google Chat post stays viewable this long (its own copy, so replacing the design never breaks it)
export const TMP_UPLOAD_HOURS = 24;      // a half-finished upload is cleared from temporary storage after this long
export const QUIET_RESEND_MINUTES = 10; // sending the same version again within this long, with nothing in between, does not notify approvers twice
