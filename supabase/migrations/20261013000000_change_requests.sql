-- A comment is a conversation by default. Only a comment marked as a change request (by an approver) is work: it is
-- assigned to someone (the person @mentioned, else the version's uploader), flips the version to Changes requested,
-- and needs to be marked done and confirmed.
alter table comments add column if not exists needs_change boolean not null default false;
alter table comments add column if not exists assignee_id uuid references users(id) on delete set null;

-- Keep today's open work visible: unresolved comments on a version that already has changes requested stay change requests.
update comments set needs_change = true
 where not is_draft and addressed_at is null and confirmed_at is null
   and version_id in (select id from versions where decision = 'changes_requested');
