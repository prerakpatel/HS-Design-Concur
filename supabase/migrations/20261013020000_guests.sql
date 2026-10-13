-- Guests (stage 1: access and read-only). A guest is an active person with no organisation membership who is on the
-- People list of one or more projects. They see only those projects, only while the project is published (draft,
-- archived and deleted projects are closed to them), and only the people on those projects.
-- Members ("staff") keep exactly the access they had.

-- Everyone on a project's People list, by email so a guest can be added before their first sign-in.
create table if not exists project_members (
  event_id uuid not null references events(id) on delete cascade,
  email text not null check (email = lower(email)),
  added_by uuid references users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (event_id, email)
);
create index if not exists project_members_email on project_members(email);
alter table project_members enable row level security;

-- The project's own chat: a Slack channel (posted to by the bot, target "slack:<channel id>") or a webhook URL.
-- Secrets: no policies, so only the server (service role) reads or writes it.
create table if not exists project_chat (
  event_id uuid primary key references events(id) on delete cascade,
  target text not null,
  platform text not null check (platform in ('slack', 'gchat')),
  label text,
  connected_by uuid references users(id) on delete set null,
  connected_at timestamptz not null default now()
);
alter table project_chat enable row level security;

-- Active and in at least one organisation: everyone who is not a guest.
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users u where u.id = auth.uid() and u.status = 'active' and exists (select 1 from org_memberships m where m.user_id = u.id))
$$;

-- On the People list of this published project.
create or replace function public.guest_of(p_event uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users u join project_members pm on pm.email = lower(u.email) join events e on e.id = pm.event_id
    where u.id = auth.uid() and u.status = 'active' and pm.event_id = p_event and e.status = 'active' and e.deleted_at is null)
$$;

create or replace function public.slot_event(p_slot uuid) returns uuid language sql stable security definer set search_path = public as $$
  select event_id from slots where id = p_slot
$$;
create or replace function public.version_event(p_version uuid) returns uuid language sql stable security definer set search_path = public as $$
  select s.event_id from versions v join slots s on s.id = v.slot_id where v.id = p_version
$$;
-- <org>/<event>/<slot>/... → the event, only when the event really belongs to that org.
create or replace function public.asset_path_event(p_name text) returns uuid language sql stable security definer set search_path = public as $$
  select e.id from events e
  where split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and e.id = split_part(p_name, '/', 2)::uuid and e.org_id = split_part(p_name, '/', 1)::uuid
$$;

-- People a guest may see: the People lists of their projects, plus anyone who created, was assigned, uploaded,
-- decided or commented there (so names on the page resolve).
create or replace function public.visible_to_guest(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  with mine as (
    select pm.event_id from users me join project_members pm on pm.email = lower(me.email) join events e on e.id = pm.event_id
    where me.id = auth.uid() and me.status = 'active' and e.status = 'active' and e.deleted_at is null)
  select exists (select 1 from mine join project_members pm on pm.event_id = mine.event_id join users u on lower(u.email) = pm.email where u.id = p_user)
      or exists (select 1 from mine join events e on e.id = mine.event_id where e.created_by = p_user)
      or exists (select 1 from mine join slots s on s.event_id = mine.event_id where s.assignee_id = p_user)
      or exists (select 1 from mine join slots s on s.event_id = mine.event_id join versions v on v.slot_id = s.id where p_user in (v.uploaded_by, v.decided_by))
      or exists (select 1 from mine join slots s on s.event_id = mine.event_id join versions v on v.slot_id = s.id join comments c on c.version_id = v.id
                 where p_user in (c.author_id, c.assignee_id, c.confirmed_by, c.addressed_by))
$$;

-- Who may change a project's People list and chat: Core Admins, and in the project's organisation its creator,
-- approvers and designers.
create or replace function public.can_manage_project(p_event uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e join users u on u.id = auth.uid()
    where e.id = p_event and u.status = 'active'
      and (u.role = 'core_admin' or (member_of(e.org_id) and (e.created_by = u.id or is_approver_of(e.org_id) or 'designer' = any(u.function_tags)))))
$$;

create policy project_members_read on project_members for select using (member_of(event_org(event_id)) or guest_of(event_id));
create policy project_members_write on project_members for all using (can_manage_project(event_id)) with check (can_manage_project(event_id));

-- Read-only access to a guest's projects. Policies are permissive, so these add to the member policies.
create policy events_guest_read on events for select using (guest_of(id));
create policy briefs_guest_read on briefs for select using (guest_of(event_id));
create policy slots_guest_read on slots for select using (guest_of(event_id));
create policy versions_guest_read on versions for select using (guest_of(slot_event(slot_id)));
create policy sides_guest_read on version_sides for select using (guest_of(version_event(version_id)));
create policy comments_guest_read on comments for select using (guest_of(version_event(version_id)) and (not is_draft or author_id = auth.uid()));
create policy activity_guest_read on activity for select using (event_id is not null and guest_of(event_id));
alter policy assets_read on storage.objects using (bucket_id = 'assets' and (member_of(asset_path_org(name)) or guest_of(asset_path_event(name))));

-- Things guests must not see: the whole people directory, memberships, groups, the glossary, org chat webhooks.
alter policy users_self on users using (id = auth.uid() or (select is_staff()) or visible_to_guest(id));
alter policy memberships_read on org_memberships using (user_id = auth.uid() or (select is_staff()));
alter policy group_members_read on group_members using ((select is_staff()));
alter policy glossary_entries_read on glossary_entries using ((select is_staff()));
alter policy glossary_variants_read on glossary_variants using ((select is_staff()));
-- People waiting for access keep what they had; an active person with no organisation (a guest) reads nothing here.
alter policy org_read on organisations using (auth.role() = 'authenticated' and ((select is_staff()) or not (select is_active())));

-- First sign-in: an email already on a People list is let straight in as a guest, with no access request.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_boot boolean; v_guest boolean;
begin
  select exists (select 1 from bootstrap_admins where lower(email) = lower(new.email)) into v_boot;
  select exists (select 1 from project_members pm join events e on e.id = pm.event_id
                 where pm.email = lower(new.email) and e.status <> 'archived' and e.deleted_at is null) into v_guest;
  insert into users (id, email, name, avatar_url, role, is_approver, status)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url',
          case when v_boot then 'core_admin'::user_role else 'member'::user_role end, v_boot,
          case when v_boot or v_guest then 'active'::user_status else 'pending'::user_status end);
  if v_boot then insert into org_memberships (user_id, org_id, is_approver) select new.id, id, true from organisations;
  elsif not v_guest then insert into access_requests (user_id) values (new.id); end if;
  return new;
end $$;
