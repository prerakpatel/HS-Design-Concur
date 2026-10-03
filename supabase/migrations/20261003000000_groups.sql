-- Applied 2026-10-03. Groups: people + a chat home + what they hear about. Chat posts route to the groups of the people concerned.
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  hears text not null default 'own' check (hears in ('all','own','milestones')),
  chat_webhook_url text,
  slack_webhook_url text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (group_id, user_id)
);
alter table groups enable row level security;
alter table group_members enable row level security;
create policy groups_read on groups for select using (member_of(org_id));
create policy groups_admin on groups for all using (is_core_admin()) with check (is_core_admin());
create policy group_members_read on group_members for select using (is_active());
create policy group_members_admin on group_members for all using (is_core_admin()) with check (is_core_admin());
