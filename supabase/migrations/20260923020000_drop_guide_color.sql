-- The viewer no longer derives a guide colour from the artwork (guides are a fixed print-proof palette).
alter table version_sides drop column if exists guide_color;
