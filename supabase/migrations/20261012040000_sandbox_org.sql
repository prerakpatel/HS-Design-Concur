-- A test organisation for trying features without touching the real channels: no chat webhooks, no chat, no email,
-- not open for sign-ups, and nobody is a member until a Core Admin adds themselves in Settings → Users.
insert into organisations (slug, name, short_name, email_enabled, chat_enabled, slack_enabled, accepting_signups, event_cap, asset_requests)
values ('sandbox', 'Test sandbox', 'Test', false, false, false, false, 50, true)
on conflict (slug) do nothing;
