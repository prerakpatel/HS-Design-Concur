-- Projects, part A (additive; safe while the live app still runs the old code).
-- An event row is now a "project": kind 'event' (as before) or 'assets' (an asset request with no
-- date or venue; event_date holds its end date). Asset items can share a format, so slots get a label
-- ("Calendar cover · March"). Each organisation gets its own project cap and a switch for requests.
alter table events add column if not exists kind text not null default 'event' check (kind in ('event', 'assets'));
alter table slots add column if not exists label text;
alter table organisations add column if not exists event_cap integer not null default 10 check (event_cap between 0 and 100);
alter table organisations add column if not exists asset_requests boolean not null default false;
update organisations set event_cap = 15, asset_requests = true where slug = 'harisumiran';
update organisations set event_cap = 5 where slug = 'acc';
