-- Applied 2026-09-24. LED backwall gets a default size; events may still override it per slot.
update formats set width = 3584, height = 1536 where key = 'led_backwall';
