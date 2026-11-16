-- Notification settings.
-- Per person: personal reminders (due soon, waiting uploads, open changes, designs awaiting review) can be switched off
-- or snoozed until a date. Per organisation: whether the channel hears about project updates, and about comments.
alter table users add column if not exists reminders_enabled boolean not null default true;
alter table users add column if not exists reminders_snooze_until date;
alter table organisations add column if not exists chat_updates boolean not null default true;
alter table organisations add column if not exists chat_comments boolean not null default true;
