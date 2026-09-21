-- Step 6: retention (PRD §8). Archive + purge a week after the event date, 7-day restore window for
-- deleted events, 30-day draft sweep with a warning at day 23.
alter table events
  add column if not exists archived_at timestamptz,
  add column if not exists purged_at timestamptz,
  add column if not exists draft_warned_at timestamptz;

create index if not exists events_event_date_idx on events (event_date) where deleted_at is null;
create index if not exists events_deleted_at_idx on events (deleted_at) where deleted_at is not null;

comment on column events.archived_at is 'Set by the nightly job when the event became read-only.';
comment on column events.purged_at is 'Set when files were reduced to one reference per approved format.';
comment on column events.draft_warned_at is 'When the creator was warned that the draft will be swept.';
