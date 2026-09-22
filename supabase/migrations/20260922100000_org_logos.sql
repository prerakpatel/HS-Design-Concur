-- Organisation logos: a public `branding` bucket (Core Admins write), `logo_path` on organisations,
-- and a column-limited view so the sign-in page can show names and logos before login.
alter table organisations add column if not exists logo_path text;

create or replace view public.org_branding as
  select id, slug, name, short_name, logo_path from public.organisations;
grant select on public.org_branding to anon, authenticated;

insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict do nothing;
create policy branding_read on storage.objects for select using (bucket_id = 'branding');
create policy branding_insert on storage.objects for insert with check (bucket_id = 'branding' and is_core_admin());
create policy branding_update on storage.objects for update using (bucket_id = 'branding' and is_core_admin());
create policy branding_delete on storage.objects for delete using (bucket_id = 'branding' and is_core_admin());
