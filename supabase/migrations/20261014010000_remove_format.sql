-- Any member of an organisation can remove a format that is a mistake or no longer used. "Removed" is a soft state
-- (removed_at, and inactive): it disappears from Settings and from every project's format picker, nothing is lost.
-- A format that a project has requested, or that has designs, is refused: turn it off (Inactive) instead.
alter table formats add column if not exists removed_at timestamptz;

create or replace function public.remove_format(p_format uuid) returns text
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if not is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from formats where id = p_format) then raise exception 'Format not found'; end if;
  select count(*) into used from slots s where s.format_id = p_format and (s.requested or exists (select 1 from versions v where v.slot_id = s.id));
  if used > 0 then return 'in_use:' || used; end if;
  update formats set active = false, removed_at = now() where id = p_format;
  return 'removed';
end $$;
revoke all on function public.remove_format(uuid) from public;
grant execute on function public.remove_format(uuid) to authenticated;
