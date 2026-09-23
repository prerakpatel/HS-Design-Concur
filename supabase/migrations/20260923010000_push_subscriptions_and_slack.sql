-- Slack incoming webhook per org, alongside Google Chat.
alter table organisations
  add column if not exists slack_enabled boolean not null default false,
  add column if not exists slack_webhook_url text;

-- Web Push subscriptions: one row per browser/device a person turned notifications on for.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
