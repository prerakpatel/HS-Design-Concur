-- Asset page redesign: per-side guide colour for safe-area overlays, comment pins per side,
-- and a primary format per event (the design the others derive from; the only reference kept after purge).
alter table version_sides add column if not exists guide_color text;
alter table comments add column if not exists pin_side side_kind not null default 'front';
alter table slots add column if not exists is_primary boolean not null default false;
create unique index if not exists slots_one_primary_per_event on slots (event_id) where is_primary;
