-- Applied 2026-09-25. "What's new": which release each person has read, and which releases were announced in chat.
alter table users add column if not exists changelog_seen text;
create table if not exists changelog_posts (
  release_id text primary key,
  posted_at timestamptz not null default now(),
  posted_by uuid references users(id)
);
alter table changelog_posts enable row level security;
create policy changelog_posts_read on changelog_posts for select using (is_active());
create policy changelog_posts_admin on changelog_posts for insert with check (is_core_admin());
