-- ============================================================
-- Team login — per-user role + allowed tabs, linked to Supabase Auth.
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
-- ============================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  role         text not null default 'member' check (role in ('admin', 'member')),
  allowed_tabs text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- Row-level security: a signed-in user can read ONLY their own profile row.
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  using (auth.uid() = id);

-- No insert/update/delete policy is granted to normal users on purpose.
-- Profiles are written by scripts/create-admin.mjs using the service_role key,
-- which bypasses RLS. To onboard a teammate, create their auth user and insert
-- a row here with role 'member' and the allowed_tabs you want them to see, e.g.:
--
--   insert into public.profiles (id, email, role, allowed_tabs)
--   values ('<their-auth-uid>', 'teammate@example.com', 'member',
--           array['dashboard','tasks','projects']);
