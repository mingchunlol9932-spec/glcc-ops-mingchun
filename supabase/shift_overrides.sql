-- ============================================================
-- Date-specific shift overrides for the Timetable + staff bot.
-- One row = one person, one date, either working or off (with a reason) —
-- a one-day exception to their normal weekly work_days.
-- Paste into the Supabase SQL Editor and Run once. Safe to re-run.
-- ============================================================
create table if not exists shift_overrides (
  id         bigint      generated always as identity primary key,
  name       text        not null,                 -- must match employees.name
  date       date        not null,
  kind       text        not null check (kind in ('work', 'off')),
  reason     text,                                  -- mc | annual | leave | extra
  created_at timestamptz not null default now(),
  unique (name, date)                              -- one override per person per day
);

-- Server-side only: the app reads/writes with the SERVICE_ROLE key (bypasses RLS).
alter table shift_overrides enable row level security;
