-- The in-app assistant (voice and typed commands that draft projects, formats and comments) is switched on per
-- person by its owner only. The column is pinned in the self-update check so nobody can switch it on for themselves.
alter table public.users add column if not exists assistant_enabled boolean not null default false;

drop function if exists public.users_self_update_ok(user_role, boolean, boolean, user_status);
create or replace function public.users_self_update_ok(p_role user_role, p_is_approver boolean, p_steward boolean, p_status user_status, p_assistant boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from users u where u.id = auth.uid() and u.role = p_role and u.is_approver = p_is_approver and u.is_glossary_steward = p_steward and u.status = p_status and u.assistant_enabled = p_assistant)
$$;
alter policy users_self_update on public.users with check (id = auth.uid() and users_self_update_ok(role, is_approver, is_glossary_steward, status, assistant_enabled));
