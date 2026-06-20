-- ============================================================
-- Queue / virtual waitlist  (the "Queue" tab)
-- Paste this whole block into the Supabase SQL Editor and Run.
-- Safe to re-run: it never drops or duplicates your data.
-- ============================================================

create table if not exists queue_entries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  party_size    int  not null default 1,
  phone         text,
  status        text not null default 'waiting',  -- waiting | called | arrived | no_show | cancelled
  queue_number  int  not null,
  table_number  text,
  created_at    timestamptz not null default now(),
  called_at     timestamptz,
  seated_at     timestamptz
);

create index if not exists queue_entries_created_idx on queue_entries (created_at);
create index if not exists queue_entries_status_idx  on queue_entries (status);

-- One-row settings table (avg minutes per table drives the wait estimate).
create table if not exists queue_settings (
  id          int primary key default 1,
  avg_minutes int not null default 45
);
insert into queue_settings (id, avg_minutes) values (1, 45)
  on conflict (id) do nothing;
