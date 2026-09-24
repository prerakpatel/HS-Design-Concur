-- Applied 2026-09-24. Per-user chat identities for @mentions, and a marker so the "new access request" post fires once.
alter table users
  add column if not exists slack_user_id text,
  add column if not exists gchat_user_id text;
alter table access_requests
  add column if not exists notified_at timestamptz;
