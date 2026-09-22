-- Brief holds exactly what goes on the designs: date (on events), time as free text, a timing note,
-- the invite text, and the venue as name + address. The separate timings table is retired.
alter table briefs
  add column if not exists time_text text,
  add column if not exists timing_note text,
  add column if not exists venue_name text,
  add column if not exists venue_address text;
update briefs set venue_name = coalesce(venue_name, venue);
alter table briefs drop column if exists venue;
drop table if exists brief_timings;
