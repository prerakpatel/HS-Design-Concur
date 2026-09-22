-- Timings are one free-text block (e.g. "10:30 AM EST onwards" + "Followed by Aarti and Mahaprasad").
update briefs set time_text = concat_ws(E'\n', time_text, timing_note) where timing_note is not null and timing_note <> '';
alter table briefs drop column if exists timing_note;
