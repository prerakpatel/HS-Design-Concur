-- Any member of an organisation can remove a format that is a mistake or no longer used. "Removed" is a soft state
-- (removed_at, and inactive): it disappears from Settings and from every project's format picker, nothing is lost.
-- A format with designs is refused (turn it off with Inactive instead); projects that only requested it, with no
-- design yet, have the request switched off.
alter table formats add column if not exists removed_at timestamptz;

create or replace function public.remove_format(p_format uuid) returns text
language plpgsql security definer set search_path = public as $$
declare designs int; others int; turned int;
begin
  if not is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from formats where id = p_format) then raise exception 'Format not found'; end if;
  select count(*) into designs from slots s where s.format_id = p_format and exists (select 1 from versions v where v.slot_id = s.id);
  if designs > 0 then return 'in_use:' || designs; end if;
  -- Requests in another organisation's projects are theirs to switch off: a Core Admin (a member of every organisation) can.
  select count(*) into others from slots s join events e on e.id = s.event_id where s.format_id = p_format and s.requested and not member_of(e.org_id);
  if others > 0 then return 'other_org:' || others; end if;
  -- Projects that asked for it but have no design yet simply stop asking.
  update slots set requested = false, is_primary = false, updated_at = now() where format_id = p_format and requested;
  get diagnostics turned = row_count;
  update formats set active = false, removed_at = now() where id = p_format;
  return 'removed:' || turned;
end $$;
revoke all on function public.remove_format(uuid) from public;
grant execute on function public.remove_format(uuid) to authenticated;
