-- Applied 2026-10-04. Approver is its own switch: Core Admin no longer implies it.
-- Today's effective approvers keep the flag (so nothing changes until someone switches it off in Settings → Users).
update users set is_approver = true where role = 'core_admin' and is_approver = false;

create or replace function public.is_approver() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and status = 'active' and is_approver)
$$;

create or replace function public.event_participants(p_event uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct u from (
    select created_by as u from events where id = p_event
    union select assignee_id from slots where event_id = p_event and assignee_id is not null
    union select c.author_id from comments c join versions v on v.id = c.version_id join slots s on s.id = v.slot_id where s.event_id = p_event
    union select m.user_id from org_memberships m join users us on us.id = m.user_id
      where m.org_id = (select org_id from events where id = p_event) and us.status = 'active' and us.is_approver
  ) t where u is not null
$$;
