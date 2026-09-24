-- Applied 2026-09-24. LED backwall is a fixed 3584 × 1536; Sambandh Glimpse leaves the catalog; order: Mobile, IG, Sambandh, TV, LED, Web, Print.
update formats set allow_custom_size = false where key = 'led_backwall';
update formats set active = false where key = 'sambandh_glimpse';
update formats set sort = v.sort from (values
  ('mobile', 1), ('ig_story', 2), ('ig_post', 3), ('sambandh_event', 4), ('tv', 5), ('led_backwall', 6),
  ('web_hero', 7), ('web_alt', 8), ('print_7x5', 9), ('print_9x6', 10), ('print_10x7', 11), ('sambandh_glimpse', 12)
) as v(key, sort) where formats.key = v.key;
