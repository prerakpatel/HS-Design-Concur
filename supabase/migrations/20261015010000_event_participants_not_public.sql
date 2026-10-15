-- event_participants() lists the people on a project and checks nobody's identity, so it must not be callable
-- without signing in (Postgres lets everyone run a new function unless this is revoked). The app calls it only
-- as a signed-in person or with the service key. Applied live 2026-10-15.
revoke all on function public.event_participants(uuid) from public, anon;
grant execute on function public.event_participants(uuid) to authenticated, service_role;
