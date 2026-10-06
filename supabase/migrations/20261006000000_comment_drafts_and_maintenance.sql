-- Review mode: comments written in a batch stay private to their author until "Send".
alter table public.comments add column if not exists is_draft boolean not null default false;
alter policy comments_read on public.comments using (member_of(version_org(version_id)) and (not is_draft or author_id = auth.uid()));

-- One-row settings table; today it holds the maintenance hold ("veil") switch.
create table if not exists public.app_settings (id boolean primary key default true check (id), maintenance boolean not null default false, maintenance_message text, maintenance_at timestamptz, maintenance_by uuid references public.users(id) on delete set null);
insert into public.app_settings (id) values (true) on conflict do nothing;
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings for select using (true);
create policy app_settings_admin on public.app_settings for update using (public.is_core_admin());
