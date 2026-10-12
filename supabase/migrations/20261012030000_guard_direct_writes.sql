-- The app checks who may approve, edit or confirm in its server actions, but the database accepted the same writes from
-- any member who called it directly. These triggers enforce the same rules at the source. Writes from the server's
-- service role (no signed-in user, auth.uid() is null: cron, retention, migrations) are not touched.

-- Versions: only an approver of the organisation decides; nobody approves their own upload; only the uploader, the
-- assigned designer or a Core Admin sends a version for review; a version never moves to another slot.
create or replace function public.guard_version_write() returns trigger language plpgsql security definer set search_path = public as $$
declare
  org uuid; approver boolean; sender boolean;
begin
  if auth.uid() is null then return new; end if;
  org := slot_org(new.slot_id);
  approver := is_approver_of(org);
  if tg_op = 'INSERT' then
    if new.decision <> 'pending' or new.sent_at is not null or new.decided_by is not null or new.decided_at is not null then
      raise exception 'A new version starts as pending and unsent' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.slot_id is distinct from old.slot_id then raise exception 'A version cannot move to another format' using errcode = '42501'; end if;
  if new.decision is distinct from old.decision or new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at then
    -- Housekeeping any member's action may cause: a newer send supersedes an older version, deleting the newest one revives the one before it.
    if not approver and not (
      (new.decision = 'superseded' and old.decision in ('pending', 'changes_requested') and new.decided_by is not distinct from old.decided_by and new.decided_at is not distinct from old.decided_at)
      or (new.decision = 'pending' and old.decision = 'superseded' and new.decided_by is not distinct from old.decided_by and new.decided_at is not distinct from old.decided_at)
    ) then
      raise exception 'Only an approver can approve, request changes or reopen' using errcode = '42501';
    end if;
    if new.decision = 'approved' and old.decision is distinct from 'approved' and new.uploaded_by = auth.uid() then
      raise exception 'You cannot approve a version you uploaded' using errcode = '42501';
    end if;
  end if;
  if new.sent_at is distinct from old.sent_at then
    sender := old.uploaded_by = auth.uid() or is_core_admin() or exists (select 1 from slots s where s.id = new.slot_id and s.assignee_id = auth.uid());
    if not sender then raise exception 'Only the uploader, the assigned designer or a Core Admin can send a version for review' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_version_write on public.versions;
create trigger guard_version_write before insert or update on public.versions for each row execute function public.guard_version_write();

-- Comments: the author and the version stay put, only the author (or a Core Admin) edits the text, only an approver confirms.
create or replace function public.guard_comment_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.author_id is distinct from old.author_id or new.version_id is distinct from old.version_id then
    raise exception 'A comment keeps its author and its version' using errcode = '42501';
  end if;
  if (new.body is distinct from old.body or new.mentions is distinct from old.mentions) and old.author_id <> auth.uid() and not is_core_admin() then
    raise exception 'You can only edit your own comments' using errcode = '42501';
  end if;
  if (new.confirmed_at is distinct from old.confirmed_at or new.confirmed_by is distinct from old.confirmed_by) and not is_approver_of(version_org(new.version_id)) then
    raise exception 'Only an approver can confirm a comment' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_comment_update on public.comments;
create trigger guard_comment_update before update on public.comments for each row execute function public.guard_comment_update();

-- Function tags (designer / publication / central) are assigned by a Core Admin, not self-service.
create or replace function public.guard_user_tags() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and new.function_tags is distinct from old.function_tags and not is_core_admin() then
    raise exception 'Function tags are set by a Core Admin' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_user_tags on public.users;
create trigger guard_user_tags before update on public.users for each row execute function public.guard_user_tags();
