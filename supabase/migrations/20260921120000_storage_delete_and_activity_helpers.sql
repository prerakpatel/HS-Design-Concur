-- Applied 2026-09-21. Storage delete/update for active members; event_participants(); published_at; slots.updated_at.
create policy assets_delete on storage.objects for delete using (bucket_id = 'assets' and is_active());
create policy assets_update on storage.objects for update using (bucket_id = 'assets' and is_active());

create or replace function public.event_participants(p_event uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct u from (
    select created_by as u from events where id = p_event
    union select assignee_id from slots where event_id = p_event and assignee_id is not null
    union select c.author_id from comments c join versions v on v.id = c.version_id join slots s on s.id = v.slot_id where s.event_id = p_event
    union select m.user_id from org_memberships m join users us on us.id = m.user_id
      where m.org_id = (select org_id from events where id = p_event) and us.status = 'active' and (us.is_approver or us.role = 'core_admin')
  ) t where u is not null
$$;

alter table events add column if not exists published_at timestamptz;
alter table slots add column if not exists updated_at timestamptz not null default now();

-- Active members may create notifications for other users (mentions, approvals, assignments).
create policy notif_insert on notifications for insert with check (is_active());
