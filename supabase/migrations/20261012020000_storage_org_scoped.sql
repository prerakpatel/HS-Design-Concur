-- Asset files are reachable only by members of the organisation they belong to.
-- Object paths start with the organisation id (<org>/<event>/<slot>/...); an upload in flight sits at tmp/<slot>/<file>
-- and belongs to the organisation of that slot. Before this, any active user could read, overwrite or delete any file.
create or replace function public.asset_path_org(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_name, '/', 1)::uuid
    when split_part(p_name, '/', 1) = 'tmp' and split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then slot_org(split_part(p_name, '/', 2)::uuid)
  end
$$;

drop policy if exists assets_read on storage.objects;
drop policy if exists assets_write on storage.objects;
drop policy if exists assets_delete on storage.objects;
drop policy if exists assets_update on storage.objects;
create policy assets_read   on storage.objects for select using (bucket_id = 'assets' and member_of(asset_path_org(name)));
create policy assets_write  on storage.objects for insert with check (bucket_id = 'assets' and member_of(asset_path_org(name)));
create policy assets_update on storage.objects for update using (bucket_id = 'assets' and member_of(asset_path_org(name)));
create policy assets_delete on storage.objects for delete using (bucket_id = 'assets' and member_of(asset_path_org(name)));

-- Backstop against oversized uploads: the app limits files to 8 MB; storage refuses anything over twice that.
update storage.buckets set file_size_limit = 16 * 1024 * 1024 where id = 'assets';
