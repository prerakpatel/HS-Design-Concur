-- Comments can be edited/deleted by their author (or a Core Admin); versions can be deleted or replaced by
-- their uploader (or a Core Admin). version_sides need update/delete for replace.
alter table comments add column if not exists edited_at timestamptz;
create policy comments_delete on comments for delete using (author_id = auth.uid() or is_core_admin());
create policy versions_delete on versions for delete using ((uploaded_by = auth.uid() or is_core_admin()) and member_of(slot_org(slot_id)));
create policy versions_uploader_update on versions for update using ((uploaded_by = auth.uid() or is_core_admin()) and member_of(slot_org(slot_id)));
create policy sides_update on version_sides for update using (member_of(version_org(version_id)));
create policy sides_delete on version_sides for delete using (member_of(version_org(version_id)));
