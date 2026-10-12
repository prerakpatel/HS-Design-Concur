-- Projects, part B. Apply only after the code that no longer needs ON CONFLICT (event_id, format_id) is live
-- (src/app/actions/formats.ts). An asset request may list one format many times (12 calendar covers), so the
-- one-slot-per-format rule now only binds unnamed slots, which is every event slot.
alter table slots drop constraint if exists slots_event_id_format_id_key;
create unique index if not exists slots_one_unnamed_per_format on slots (event_id, format_id) where label is null;
create unique index if not exists slots_named_once on slots (event_id, format_id, label) where label is not null;

-- A format for video thumbnails, used by asset requests (and available to events).
insert into formats (key, name, width, height, unit, class, frame, sort)
select 'youtube_thumb', 'YouTube Thumbnail', 1280, 720, 'px', 'digital', 'flat', coalesce(max(sort), 0) + 1 from formats
where not exists (select 1 from formats where key = 'youtube_thumb');
