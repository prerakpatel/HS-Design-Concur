-- Anyone in the organisation can ask for a change on the newest sent version. That sends the version back (from in
-- review, or from approved, which reopens it). This function does the flip for them, after checking they belong to
-- the organisation, so the version's own write rules (approvers decide) stay strict for everything else.
create or replace function public.flip_to_changes(p_version uuid, p_reopen boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare v versions%rowtype;
begin
  select * into v from versions where id = p_version;
  if not found then raise exception 'Version not found'; end if;
  if not member_of(slot_org(v.slot_id)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v.sent_at is null then raise exception 'This version has not been sent for review yet'; end if;
  if v.number <> (select max(number) from versions where slot_id = v.slot_id) then raise exception 'A newer version exists'; end if;
  if v.decision = 'approved' and not p_reopen then raise exception 'This version is approved. Reopen it to ask for changes.'; end if;
  if v.decision not in ('pending', 'approved', 'changes_requested') then raise exception 'This version cannot take changes'; end if;
  if v.decision <> 'changes_requested' then
    perform set_config('app.flip_changes', 'on', true);
    update versions set decision = 'changes_requested', decided_by = auth.uid(), decided_at = now() where id = p_version;
    update slots set state = 'changes_requested', updated_at = now() where id = v.slot_id;
  end if;
end $$;
revoke all on function public.flip_to_changes(uuid, boolean) from public;
grant execute on function public.flip_to_changes(uuid, boolean) to authenticated;

-- The version write guard lets flip_to_changes() through (it checks who is asking itself).
create or replace function public.guard_version_write() returns trigger language plpgsql security definer set search_path = public as $$
declare
  org uuid; approver boolean; sender boolean;
begin
  if auth.uid() is null or current_setting('app.flip_changes', true) = 'on' then return new; end if;
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
