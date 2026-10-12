-- Only the author edits a comment's text; a Core Admin can delete one (moderation) but never rewrite it.
create or replace function public.guard_comment_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.author_id is distinct from old.author_id or new.version_id is distinct from old.version_id then
    raise exception 'A comment keeps its author and its version' using errcode = '42501';
  end if;
  if (new.body is distinct from old.body or new.mentions is distinct from old.mentions) and old.author_id <> auth.uid() then
    raise exception 'You can only edit your own comments' using errcode = '42501';
  end if;
  if (new.confirmed_at is distinct from old.confirmed_at or new.confirmed_by is distinct from old.confirmed_by) and not is_approver_of(version_org(new.version_id)) then
    raise exception 'Only an approver can confirm a comment' using errcode = '42501';
  end if;
  return new;
end $$;
