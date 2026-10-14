-- Notifications belong to an organisation. A person sees one only while they are still a member of that
-- organisation; a guest sees only those about a published project they are on the People list of.
-- Notifications with no organisation (e.g. a cross-org digest) stay visible to their recipient.
alter table notifications add column if not exists org_id uuid references organisations(id) on delete cascade;

-- Existing rows: take the organisation from the project they point at.
update notifications n set org_id = e.org_id
from events e
where n.org_id is null
  and n.payload->>'eventId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and e.id = (n.payload->>'eventId')::uuid;

create index if not exists notifications_user_org on notifications(user_id, org_id);

drop policy if exists notif_self on notifications;
create policy notif_self on notifications for select using (
  user_id = auth.uid() and (
    org_id is null
    or member_of(org_id)
    or (payload->>'eventId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and guest_of((payload->>'eventId')::uuid))
  )
);
