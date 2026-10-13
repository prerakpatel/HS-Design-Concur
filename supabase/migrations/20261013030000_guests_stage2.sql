-- Guests, stage 2: on their projects guests comment, ask for changes and upload (any format), but never approve,
-- assign, or change the project or a format's setup. Also: the People list and the chat link are read through
-- functions, so pages never need the service key. Applied 2026-10-13.

-- Everyone on a project (the listed people, its creator and assigned designers) with what they are there; empty
-- when the project has no People list. For members of the project's organization and its guests only.
create or replace function public.project_people(p_event uuid)
returns table (email text, user_id uuid, name text, avatar_url text, is_member boolean, is_approver boolean, is_creator boolean, is_assigned boolean, listed boolean)
language sql stable security definer set search_path = public as $$
  with ev as (select id, org_id, created_by from events where id = p_event and (auth.role() = 'service_role' or member_of(org_id) or guest_of(id))),
  listed as (select pm.email from project_members pm join ev on ev.id = pm.event_id),
  workers as (select u.id from ev join users u on u.id = ev.created_by
              union select s.assignee_id from slots s join ev on ev.id = s.event_id where s.assignee_id is not null),
  everyone as (
    select l.email, u.id as uid, true as listed from listed l left join users u on lower(u.email) = l.email
    union all
    select lower(u.email), u.id, false from workers w join users u on u.id = w.id where lower(u.email) not in (select email from listed))
  select e.email, e.uid, u.name, u.avatar_url,
         m.user_id is not null, coalesce(m.is_approver, false),
         e.uid = (select created_by from ev), e.uid in (select s.assignee_id from slots s where s.event_id = p_event and s.assignee_id is not null),
         e.listed
  from everyone e left join users u on u.id = e.uid
  left join org_memberships m on m.user_id = e.uid and m.org_id = (select org_id from ev)
  where exists (select 1 from listed)
$$;

-- Where the project's chat goes, without the secret link.
create or replace function public.project_chat_info(p_event uuid)
returns table (platform text, label text)
language sql stable security definer set search_path = public as $$
  select c.platform, c.label from project_chat c join events e on e.id = c.event_id
  where c.event_id = p_event and (member_of(e.org_id) or guest_of(e.id))
$$;

-- Storage paths a guest may write: their project's files, and uploads in flight for its formats (tmp/<slot>/...).
create or replace function public.guest_path_ok(p_name text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(guest_of(asset_path_event(p_name)), false)
      or (split_part(p_name, '/', 1) = 'tmp' and split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and coalesce(guest_of(slot_event(split_part(p_name, '/', 2)::uuid)), false))
$$;

create or replace function public.guard_guest_slot() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A guest moves a format's state (upload, send, change request) and nothing else: not its assignee, due date, size or brief.
  if auth.uid() is null or member_of(event_org(old.event_id)) then return new; end if;
  if (to_jsonb(new) - 'state' - 'updated_at') is distinct from (to_jsonb(old) - 'state' - 'updated_at') then
    raise exception 'Guests can only upload and comment' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_guest_slot before update on slots for each row execute function guard_guest_slot();

create or replace function public.guard_guest_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A guest's first upload locks the brief; that is the only change a guest makes to a project.
  if auth.uid() is null or member_of(old.org_id) then return new; end if;
  if old.brief_locked_at is not null or new.brief_locked_at is null
     or (to_jsonb(new) - 'brief_locked_at') is distinct from (to_jsonb(old) - 'brief_locked_at') then
    raise exception 'Guests cannot change the project' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_guest_event before update on events for each row execute function guard_guest_event();

create policy comments_guest_insert on comments for insert with check (guest_of(version_event(version_id)) and author_id = auth.uid());
create policy comments_guest_update on comments for update using (guest_of(version_event(version_id)));
create policy versions_guest_insert on versions for insert with check (guest_of(slot_event(slot_id)) and uploaded_by = auth.uid());
create policy versions_guest_update on versions for update using (uploaded_by = auth.uid() and guest_of(slot_event(slot_id)));
create policy versions_guest_delete on versions for delete using (uploaded_by = auth.uid() and guest_of(slot_event(slot_id)));
create policy sides_guest_write on version_sides for all using (guest_of(version_event(version_id))) with check (guest_of(version_event(version_id)));
create policy slots_guest_update on slots for update using (guest_of(event_id));
create policy events_guest_update on events for update using (guest_of(id));
create policy activity_guest_insert on activity for insert with check (guest_of(event_id) and actor_id = auth.uid());

alter policy assets_read   on storage.objects using (bucket_id = 'assets' and (member_of(asset_path_org(name)) or guest_path_ok(name)));
alter policy assets_write  on storage.objects with check (bucket_id = 'assets' and (member_of(asset_path_org(name)) or guest_path_ok(name)));
alter policy assets_update on storage.objects using (bucket_id = 'assets' and (member_of(asset_path_org(name)) or guest_path_ok(name)));
alter policy assets_delete on storage.objects using (bucket_id = 'assets' and (member_of(asset_path_org(name)) or guest_path_ok(name)));

-- Anyone on the project, guests too, can send the newest sent version back with a change request.
create or replace function public.flip_to_changes(p_version uuid, p_reopen boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v versions%rowtype;
begin
  select * into v from versions where id = p_version;
  if not found then raise exception 'Version not found'; end if;
  if not (member_of(slot_org(v.slot_id)) or guest_of(slot_event(v.slot_id))) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v.sent_at is null then raise exception 'This version has not been sent for review yet'; end if;
  if v.number <> (select max(number) from versions where slot_id = v.slot_id) then raise exception 'A newer version exists'; end if;
  if v.decision = 'approved' and not p_reopen then raise exception 'This version is approved. Reopen it to ask for changes.'; end if;
  if v.decision not in ('pending', 'approved', 'changes_requested') then raise exception 'This version cannot take changes'; end if;
  if v.decision <> 'changes_requested' then
    perform set_config('app.flip_changes', 'on', true);
    update versions set decision = 'changes_requested', decided_by = auth.uid(), decided_at = now() where id = p_version;
    update slots set state = 'changes_requested', updated_at = now() where id = v.slot_id;
  end if;
end $$;
