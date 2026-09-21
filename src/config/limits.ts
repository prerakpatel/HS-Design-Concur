/** Storage and calendar limits from PRD §8. */
export const EVENT_CAP = 10;            // non-draft, non-archived events across both orgs
export const MONTHS_AHEAD = 6;          // an event may not be dated further out than this
export const PURGE_AFTER_DAYS = 7;      // days after the event date before it is archived and its files purged
export const DELETE_RESTORE_DAYS = 7;   // Core Admins can restore a deleted event for this long; files go after
export const DRAFT_SWEEP_DAYS = 30;     // untouched drafts are deleted after this
export const DRAFT_WARN_DAYS = 23;      // the creator is warned on this day
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
