-- Approving a new person failed with "infinite recursion detected in policy for relation users": the self-update
-- policy read users inside its own check. The comparison now lives in a security definer function, which reads the
-- row without going through the policies again. Same rule as before: you cannot change your own role, approver flag,
-- glossary steward flag or status.
create or replace function public.users_self_update_ok(p_role user_role, p_is_approver boolean, p_steward boolean, p_status user_status) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from users u where u.id = auth.uid() and u.role = p_role and u.is_approver = p_is_approver and u.is_glossary_steward = p_steward and u.status = p_status)
$$;
alter policy users_self_update on public.users with check (id = auth.uid() and users_self_update_ok(role, is_approver, is_glossary_steward, status));
