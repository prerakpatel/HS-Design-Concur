/** Storage and calendar limits from PRD §8. */
export const EVENT_CAP = 10;          // non-draft, non-archived events across both orgs
export const MONTHS_AHEAD = 6;        // an event may not be dated further out than this
export const MONTHS_BACK = 6;         // events older than this are archived nightly
export const PURGE_AFTER_DAYS = 7;    // days after the event date before files are purged
export const DRAFT_SWEEP_DAYS = 30;   // untouched drafts are deleted after this
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
