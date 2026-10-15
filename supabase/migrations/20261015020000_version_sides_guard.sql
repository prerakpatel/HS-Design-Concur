-- A design's files may be changed only inside that design's own folder, and an approved design's files only by a
-- Core Admin. Row-level security lets any member (and guest) write version_sides directly, skipping the app, so
-- without this a person could point an "approved" file at another project's upload or at someone else's folder.
-- The server's own work (service key: uploads' cleanup, pruning, retention, preview refresh) has no signed-in
-- person and passes. Existing rows already all follow the folder rule (checked 2026-10-15).
create or replace function public.guard_version_sides() returns trigger
language plpgsql security definer set search_path = public as $$
declare v record; prefix text; p text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from versions where id = old.version_id and decision = 'approved') and not is_core_admin() then
      raise exception 'An approved version can only be changed by a Core Admin' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
    raise exception 'A file stays with its version' using errcode = '42501';
  end if;
  select ver.decision, e.org_id, e.id as event_id, ver.slot_id into v
    from versions ver join slots s on s.id = ver.slot_id join events e on e.id = s.event_id where ver.id = new.version_id;
  if not found then raise exception 'Version not found' using errcode = '42501'; end if;
  if v.decision = 'approved' and not is_core_admin() then
    raise exception 'An approved version can only be changed by a Core Admin' using errcode = '42501';
  end if;
  prefix := v.org_id || '/' || v.event_id || '/' || v.slot_id || '/';
  foreach p in array array[new.optimised_path, new.preview_path, new.thumb_path, new.reference_path] loop
    if p is not null and (left(regexp_replace(p, '^r2:', ''), length(prefix)) <> prefix or p ~ '(^|/)\.\.(/|$)') then
      raise exception 'A file must be stored in its own design folder' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists guard_version_sides on public.version_sides;
create trigger guard_version_sides before insert or update or delete on public.version_sides
  for each row execute function public.guard_version_sides();
