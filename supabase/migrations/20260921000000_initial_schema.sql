-- Design & Concur — initial schema (PRD §14). Applied to project gegiwouyrhcexjozkbhh on 2026-09-21.
create extension if not exists "pgcrypto";

create type user_role as enum ('member','core_admin');
create type user_status as enum ('pending','active','removed');
create type email_pref as enum ('instant','digest','off');
create type function_tag as enum ('central','publication','designer');
create type size_unit as enum ('px','in');
create type format_class as enum ('print','digital');
create type frame_type as enum ('phone','card','flat','tv','led','print');
create type event_status as enum ('draft','active','archived');
create type slot_state as enum ('requested','in_review','changes_requested','approved');
create type decision_state as enum ('pending','approved','changes_requested','superseded');
create type side_kind as enum ('front','back');

create table organisations (id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, short_name text not null, chat_webhook_url text, email_enabled boolean not null default true, chat_enabled boolean not null default false, accepting_signups boolean not null default true, created_at timestamptz not null default now());
create table bootstrap_admins (email text primary key);
create table users (id uuid primary key references auth.users(id) on delete cascade, email text not null unique, name text, avatar_url text, role user_role not null default 'member', is_approver boolean not null default false, function_tags function_tag[] not null default '{}', status user_status not null default 'pending', email_pref email_pref not null default 'instant', created_at timestamptz not null default now());
create table org_memberships (user_id uuid references users(id) on delete cascade, org_id uuid references organisations(id) on delete cascade, primary key (user_id, org_id));
create table access_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, requested_at timestamptz not null default now(), decided_by uuid references users(id), decided_at timestamptz, decision text check (decision in ('approved','denied')));
create table formats (id uuid primary key default gen_random_uuid(), key text unique not null, name text not null, width numeric, height numeric, unit size_unit not null default 'px', dpi integer, class format_class not null default 'digital', frame frame_type not null default 'flat', safe_top integer not null default 0, safe_right integer not null default 0, safe_bottom integer not null default 0, safe_left integer not null default 0, bleed_in numeric, safe_margin_in numeric, allow_custom_size boolean not null default false, allowed_mimes text[] not null default '{image/png,image/jpeg,image/webp,image/gif}', notes text, active boolean not null default true, sort integer not null default 0);
create table events (id uuid primary key default gen_random_uuid(), org_id uuid not null references organisations(id), title text not null, event_date date, venue text, status event_status not null default 'draft', created_by uuid not null references users(id), brief_locked_at timestamptz, deleted_at timestamptz, last_edited_at timestamptz not null default now(), created_at timestamptz not null default now());
create table briefs (event_id uuid primary key references events(id) on delete cascade, description text, venue text, notes text);
create table brief_timings (id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id) on delete cascade, label text, on_date date, starts_at time, ends_at time, sort integer not null default 0);
create table slots (id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id) on delete cascade, format_id uuid not null references formats(id), requested boolean not null default true, custom_w integer, custom_h integer, notes text, assignee_id uuid references users(id), due_on date, state slot_state not null default 'requested', unique (event_id, format_id));
create table versions (id uuid primary key default gen_random_uuid(), slot_id uuid not null references slots(id) on delete cascade, number integer not null, uploaded_by uuid not null references users(id), source_link text, decision decision_state not null default 'pending', decided_by uuid references users(id), decided_at timestamptz, reopen_reason text, purged_at timestamptz, created_at timestamptz not null default now(), unique (slot_id, number));
create table version_sides (id uuid primary key default gen_random_uuid(), version_id uuid not null references versions(id) on delete cascade, side side_kind not null default 'front', mime text, width integer, height integer, bytes integer, optimised_path text, preview_path text, thumb_path text, reference_path text, unique (version_id, side));
create table comments (id uuid primary key default gen_random_uuid(), version_id uuid not null references versions(id) on delete cascade, author_id uuid not null references users(id), parent_id uuid references comments(id) on delete cascade, body text not null, mentions uuid[] not null default '{}', pin_x numeric, pin_y numeric, addressed_at timestamptz, addressed_by uuid references users(id), confirmed_at timestamptz, confirmed_by uuid references users(id), created_at timestamptz not null default now());
create table activity (id bigserial primary key, org_id uuid not null references organisations(id), event_id uuid references events(id) on delete cascade, slot_id uuid references slots(id) on delete cascade, version_id uuid references versions(id) on delete cascade, actor_id uuid references users(id), kind text not null, payload jsonb not null default '{}', created_at timestamptz not null default now());
create table notifications (id bigserial primary key, user_id uuid not null references users(id) on delete cascade, kind text not null, payload jsonb not null default '{}', read_at timestamptz, emailed_at timestamptz, created_at timestamptz not null default now());

create index on events (org_id, status, event_date);
create index on slots (event_id);
create index on versions (slot_id);
create index on comments (version_id);
create index on activity (org_id, created_at desc);
create index on notifications (user_id, read_at);

create or replace function public.current_user_status() returns user_status language sql stable security definer set search_path = public as $$ select status from users where id = auth.uid() $$;
create or replace function public.is_active() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from users where id = auth.uid() and status = 'active') $$;
create or replace function public.is_core_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from users where id = auth.uid() and status = 'active' and role = 'core_admin') $$;
create or replace function public.is_approver() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from users where id = auth.uid() and status = 'active' and (is_approver or role = 'core_admin')) $$;
create or replace function public.is_designer() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from users where id = auth.uid() and status = 'active' and ('designer' = any(function_tags) or role = 'core_admin')) $$;
create or replace function public.member_of(p_org uuid) returns boolean language sql stable security definer set search_path = public as $$ select is_active() and exists (select 1 from org_memberships where user_id = auth.uid() and org_id = p_org) $$;
create or replace function public.event_org(p_event uuid) returns uuid language sql stable security definer set search_path = public as $$ select org_id from events where id = p_event $$;
create or replace function public.slot_org(p_slot uuid) returns uuid language sql stable security definer set search_path = public as $$ select e.org_id from slots s join events e on e.id = s.event_id where s.id = p_slot $$;
create or replace function public.version_org(p_version uuid) returns uuid language sql stable security definer set search_path = public as $$ select e.org_id from versions v join slots s on s.id = v.slot_id join events e on e.id = s.event_id where v.id = p_version $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_boot boolean;
begin
  select exists (select 1 from bootstrap_admins where lower(email) = lower(new.email)) into v_boot;
  insert into users (id, email, name, avatar_url, role, is_approver, status)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url',
          case when v_boot then 'core_admin'::user_role else 'member'::user_role end, v_boot,
          case when v_boot then 'active'::user_status else 'pending'::user_status end);
  if v_boot then insert into org_memberships (user_id, org_id) select new.id, id from organisations;
  else insert into access_requests (user_id) values (new.id); end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table organisations enable row level security; alter table bootstrap_admins enable row level security; alter table users enable row level security; alter table org_memberships enable row level security; alter table access_requests enable row level security; alter table formats enable row level security; alter table events enable row level security; alter table briefs enable row level security; alter table brief_timings enable row level security; alter table slots enable row level security; alter table versions enable row level security; alter table version_sides enable row level security; alter table comments enable row level security; alter table activity enable row level security; alter table notifications enable row level security;

create policy org_read on organisations for select using (auth.role() = 'authenticated');
create policy org_admin on organisations for update using (is_core_admin());
create policy users_self on users for select using (id = auth.uid() or is_active());
create policy users_self_update on users for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from users u where u.id = auth.uid()) and is_approver = (select is_approver from users u where u.id = auth.uid()) and status = (select status from users u where u.id = auth.uid()));
create policy users_admin on users for all using (is_core_admin());
create policy memberships_read on org_memberships for select using (is_active());
create policy memberships_admin on org_memberships for all using (is_core_admin());
create policy access_self on access_requests for select using (user_id = auth.uid() or is_core_admin());
create policy access_admin on access_requests for update using (is_core_admin());
create policy formats_read on formats for select using (is_active());
create policy formats_write on formats for all using (is_designer());
create policy events_read on events for select using (member_of(org_id));
create policy events_insert on events for insert with check (member_of(org_id) and created_by = auth.uid());
create policy events_update on events for update using (member_of(org_id));
create policy events_delete on events for delete using (is_core_admin() or (created_by = auth.uid() and not exists (select 1 from slots s join versions v on v.slot_id = s.id where s.event_id = events.id)));
create policy briefs_rw on briefs for all using (member_of(event_org(event_id)));
create policy timings_rw on brief_timings for all using (member_of(event_org(event_id)));
create policy slots_rw on slots for all using (member_of(event_org(event_id)));
create policy versions_read on versions for select using (member_of(slot_org(slot_id)));
create policy versions_insert on versions for insert with check (member_of(slot_org(slot_id)) and uploaded_by = auth.uid());
create policy versions_decide on versions for update using (is_approver() and member_of(slot_org(slot_id)));
create policy sides_read on version_sides for select using (member_of(version_org(version_id)));
create policy sides_insert on version_sides for insert with check (member_of(version_org(version_id)));
create policy comments_read on comments for select using (member_of(version_org(version_id)));
create policy comments_insert on comments for insert with check (member_of(version_org(version_id)) and author_id = auth.uid());
create policy comments_update on comments for update using (member_of(version_org(version_id)));
create policy activity_read on activity for select using (member_of(org_id));
create policy activity_insert on activity for insert with check (member_of(org_id));
create policy notif_self on notifications for select using (user_id = auth.uid());
create policy notif_self_update on notifications for update using (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('assets','assets',false) on conflict do nothing;
create policy assets_read on storage.objects for select using (bucket_id = 'assets' and is_active());
create policy assets_write on storage.objects for insert with check (bucket_id = 'assets' and is_active());

insert into organisations (slug, name, short_name) values ('harisumiran','Harisumiran','Harisumiran'), ('acc','Atmiya Care Charities','ACC');
insert into bootstrap_admins (email) values ('pushkar936@gmail.com'), ('pushkar.patel@hariss.org'), ('anand.shah@hariss.org');
insert into formats (key,name,width,height,unit,dpi,class,frame,safe_top,safe_bottom,bleed_in,safe_margin_in,allow_custom_size,allowed_mimes,sort) values
 ('sambandh_event','Sambandh Event',1125,1200,'px',null,'digital','phone',249,0,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',1),
 ('sambandh_glimpse','Sambandh Glimpse',1074,645,'px',null,'digital','card',0,0,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',2),
 ('mobile','Mobile',1179,2556,'px',null,'digital','phone',264,0,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',3),
 ('ig_story','IG Reel / Story',1080,1920,'px',null,'digital','phone',240,240,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',4),
 ('ig_post','IG Post',1080,1350,'px',null,'digital','flat',168,168,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',5),
 ('tv','TV',1920,1080,'px',null,'digital','tv',0,0,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',6),
 ('web_hero','Website Hero',1920,540,'px',null,'digital','flat',0,0,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',7),
 ('web_alt','Web (1500)',1500,548,'px',null,'digital','flat',0,0,null,null,false,'{image/png,image/jpeg,image/webp,image/gif}',8),
 ('print_7x5','Print 7 × 5 in',7.5,5.5,'in',300,'print','print',0,0,0.25,0.25,false,'{image/png,image/jpeg,application/pdf}',9),
 ('print_9x6','Print 9 × 6 in',9.5,6.5,'in',300,'print','print',0,0,0.25,0.25,false,'{image/png,image/jpeg,application/pdf}',10),
 ('print_10x7','Print 10 × 7 in',10.5,7.5,'in',300,'print','print',0,0,0.25,0.25,false,'{image/png,image/jpeg,application/pdf}',11),
 ('led_backwall','LED backwall',null,null,'px',null,'digital','led',0,0,null,null,true,'{image/png,image/jpeg,image/webp,image/gif}',12);
