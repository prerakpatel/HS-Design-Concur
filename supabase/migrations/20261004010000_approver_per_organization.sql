-- Applied 2026-10-04. Approver is per organization: the flag lives on the membership, not on the person.
-- users.is_approver is now legacy (kept so older rows and the self-update policy keep working); nothing reads it.
alter table org_memberships add column if not exists is_approver boolean not null default false;
-- Whoever approves today approves in every org they belong to; copy that so nothing changes until someone is narrowed.
update org_memberships m set is_approver = true from users u where u.id = m.user_id and u.is_approver;

create or replace function public.is_approver_of(p_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_memberships m join users u on u.id = m.user_id where m.user_id = auth.uid() and m.org_id = p_org and m.is_approver and u.status = 'active')
$$;
create or replace function public.is_approver() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_memberships m join users u on u.id = m.user_id where m.user_id = auth.uid() and m.is_approver and u.status = 'active')
$$;

drop policy if exists versions_decide on versions;
create policy versions_decide on versions for update using (is_approver_of(slot_org(slot_id)));

create or replace function public.event_participants(p_event uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct u from (
    select created_by as u from events where id = p_event
    union select assignee_id from slots where event_id = p_event and assignee_id is not null
    union select c.author_id from comments c join versions v on v.id = c.version_id join slots s on s.id = v.slot_id where s.event_id = p_event
    union select m.user_id from org_memberships m join users us on us.id = m.user_id
      where m.org_id = (select org_id from events where id = p_event) and us.status = 'active' and m.is_approver
  ) t where u is not null
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_boot boolean;
begin
  select exists (select 1 from bootstrap_admins where lower(email) = lower(new.email)) into v_boot;
  insert into users (id, email, name, avatar_url, role, is_approver, status)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url',
          case when v_boot then 'core_admin'::user_role else 'member'::user_role end, v_boot,
          case when v_boot then 'active'::user_status else 'pending'::user_status end);
  if v_boot then insert into org_memberships (user_id, org_id, is_approver) select new.id, id, true from organisations;
  else insert into access_requests (user_id) values (new.id); end if;
  return new;
end $$;
