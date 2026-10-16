-- A Core Admin has full update rights on every user, themselves included, so "you cannot disable or remove yourself"
-- held only because the app enforced it. This makes it true in the database too: a signed-in person cannot set their own
-- status to disabled or removed; another Core Admin has to do it. Disabling or removing someone else, enabling people,
-- and the server's own work (no signed-in person) are unaffected. Applied live 2026-10-16.
create or replace function public.guard_user_self_status() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and new.status is distinct from old.status and new.status in ('disabled', 'removed') then
    raise exception 'You cannot turn off your own access. Another Core Admin has to do it' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_user_self_status on public.users;
create trigger guard_user_self_status before update of status on public.users for each row execute function public.guard_user_self_status();
