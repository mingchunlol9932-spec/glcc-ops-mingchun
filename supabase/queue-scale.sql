-- ============================================================
-- Queue hardening — make the queue safe for big rushes (e.g. 300 walk-ins).
-- Run this ONCE in the Supabase SQL editor (it's idempotent — safe to re-run).
--
-- The old code computed the next queue number in JavaScript (max + 1), which
-- races under load: two people who tap "join" at the same instant read the same
-- max and get the SAME number. This moves numbering into the database so it is
-- assigned atomically inside the INSERT and can never collide.
-- ============================================================

-- Per-service-day counter. One row per day; the upsert below locks that single
-- row, so concurrent inserts serialize on it and each gets a unique number.
create table if not exists queue_counters (
  service_day  date primary key,
  last_number  int  not null default 0
);

-- Tag each entry with the Malaysia-time service day it belongs to, so the unique
-- constraint below is per-day (numbers restart at 1 each day).
alter table queue_entries add column if not exists service_day date;

-- Atomically assign queue_number (and service_day) on insert.
create or replace function assign_queue_number() returns trigger as $$
declare
  d date := (timezone('Asia/Kuala_Lumpur', now()))::date;  -- MYT service day
  n int;
begin
  -- If a number was supplied explicitly (e.g. a data import), respect it.
  if new.queue_number is not null and new.queue_number <> 0 then
    if new.service_day is null then new.service_day := d; end if;
    return new;
  end if;

  -- Atomic increment of today's counter; the row lock serializes concurrent joins.
  insert into queue_counters (service_day, last_number)
    values (d, 1)
  on conflict (service_day)
    do update set last_number = queue_counters.last_number + 1
  returning last_number into n;

  new.service_day  := d;
  new.queue_number := n;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_queue_number on queue_entries;
create trigger trg_assign_queue_number
  before insert on queue_entries
  for each row
  execute function assign_queue_number();

-- Hard backstop: even if something bypasses the trigger, the DB refuses two
-- entries with the same number on the same day. (NULL service_day rows from
-- before this migration are exempt — NULLs don't collide in a unique index.)
create unique index if not exists queue_entries_day_num_uniq
  on queue_entries (service_day, queue_number);

-- Speeds up the "how many groups are ahead of me" count that every waiting
-- phone runs on each poll: only active rows are indexed, by queue_number.
create index if not exists queue_entries_active_num_idx
  on queue_entries (queue_number)
  where status in ('waiting', 'called');
