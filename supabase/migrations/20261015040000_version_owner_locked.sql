-- "You cannot approve a version you uploaded" is checked against versions.uploaded_by, and row-level security let
-- an approver rewrite that field and approve in the same update (hand the upload to someone else, then approve it).
-- A version now keeps its uploader, number and format. The one allowed change is the app's own in-place replace:
-- a person taking over a still-pending version for themselves. The server key (no signed-in person) is not
-- restricted. This adds a trigger beside guard_version_write; that function is unchanged. Applied live 2026-10-15.
create or replace function public.guard_version_owner() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.number is distinct from old.number or new.slot_id is distinct from old.slot_id then
    raise exception 'A version keeps its number and its format' using errcode = '42501';
  end if;
  if new.uploaded_by is distinct from old.uploaded_by
     and not (new.uploaded_by = auth.uid() and old.decision = 'pending' and new.decision = 'pending') then
    raise exception 'The person who uploaded a version cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_version_owner on public.versions;
create trigger guard_version_owner before update on public.versions for each row execute function public.guard_version_owner();
