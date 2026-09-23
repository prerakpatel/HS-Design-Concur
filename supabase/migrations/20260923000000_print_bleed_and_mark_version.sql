-- Print templates use a 0.125 in bleed; the safe margin stays 0.25 in from trim.
update formats set bleed_in = 0.125 where class = 'print' and bleed_in = 0.25;

-- Which watermark generation a side's preview carries. 0 = old tiled mark; the app re-renders anything older
-- than its current mark on first view.
alter table version_sides add column if not exists mark_version smallint not null default 0;

-- File size = trim + bleed on each side, so the seeded print sizes shrink with the bleed (7.5 → 7.25 etc.).
update formats set width = width - 0.25, height = height - 0.25 where class = 'print' and bleed_in = 0.125 and width in (7.5, 9.5, 10.5);
