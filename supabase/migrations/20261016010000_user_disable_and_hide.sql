-- Disable user: a reversible way to cut someone's access. A new status, 'disabled', sits beside active / pending /
-- removed. Every access rule already asks "is this person active?" (is_active(), member_of(), the app's own checks), so a
-- disabled person loses everything at once, and unlike Remove their organizations, role and groups are kept, so
-- enabling them restores everything. Only a Core Admin can change status (users_self_update_ok pins it for everyone else).
alter type public.user_status add value if not exists 'disabled';

-- Hide from lists: the person keeps full access and their name still shows on what they create, upload or comment on,
-- but they are left out of @ suggestions, the designer picker and the project People suggestions.
alter table public.users add column if not exists hide_in_lists boolean not null default false;

-- Only a Core Admin may change it (a person could otherwise hide or unhide themselves through the API).
create or replace function public.guard_user_hide() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.hide_in_lists is distinct from old.hide_in_lists and not is_core_admin() then
    raise exception 'Only a Core Admin can change who is hidden from lists' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_user_hide on public.users;
create trigger guard_user_hide before update of hide_in_lists on public.users for each row execute function public.guard_user_hide();
