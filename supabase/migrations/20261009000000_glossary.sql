-- Glossary of satsang spellings (PRD §16). Text only; read by every active user, edited by stewards.
alter table public.users add column if not exists is_glossary_steward boolean not null default false;

create table if not exists public.glossary_entries (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  term_key text not null unique,
  sound_key text not null,
  definition text,
  source text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists glossary_entries_sound_key on public.glossary_entries (sound_key);
create table if not exists public.glossary_variants (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.glossary_entries(id) on delete cascade,
  spelling text not null,
  spelling_key text not null,
  sound_key text not null,
  unique (entry_id, spelling_key)
);
create index if not exists glossary_variants_entry on public.glossary_variants (entry_id);
alter table public.glossary_entries enable row level security;
alter table public.glossary_variants enable row level security;

create or replace function public.is_glossary_steward() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from users where id = auth.uid() and status = 'active' and is_glossary_steward) $$;
create policy glossary_entries_read on public.glossary_entries for select using (is_active());
create policy glossary_entries_write on public.glossary_entries for all using (is_glossary_steward()) with check (is_glossary_steward());
create policy glossary_variants_read on public.glossary_variants for select using (is_active());
create policy glossary_variants_write on public.glossary_variants for all using (is_glossary_steward()) with check (is_glossary_steward());

-- A member must not be able to promote themselves.
alter policy users_self_update on public.users with check (id = auth.uid() and role = (select u.role from users u where u.id = auth.uid()) and is_approver = (select u.is_approver from users u where u.id = auth.uid()) and is_glossary_steward = (select u.is_glossary_steward from users u where u.id = auth.uid()) and status = (select u.status from users u where u.id = auth.uid()));
