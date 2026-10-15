-- Guest access is matched on email (project_members.email = lower(users.email)), and row-level security let any
-- signed-in person rewrite their own email directly, which could claim someone else's pending guest invite (and
-- block that person from signing up, since emails are unique). Nothing in the app edits an email, so a signed-in
-- person can no longer change one. Account creation (an insert) and the server key (no signed-in person) pass.
-- Applied live 2026-10-15.
create or replace function public.guard_user_email() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'An email address cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_user_email on public.users;
create trigger guard_user_email before update of email on public.users for each row execute function public.guard_user_email();
