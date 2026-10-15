-- Signed-in people can no longer create notifications (it let anyone put their own words in someone's Inbox, and in
-- the emails sent from them: any active user could insert a row for any user). The app writes notifications with
-- the server key, which is not subject to row-level security, so nothing else changes. People still read and mark
-- their own notifications (notif_self, notif_self_update). Applied live 2026-10-15.
-- To undo: alter policy notif_insert on public.notifications with check (is_active());
alter policy notif_insert on public.notifications with check (false);
