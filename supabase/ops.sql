-- ============================================================
-- Gepuklah Ops — table turnover + queue capacity + dashboard
-- Paste into Supabase SQL Editor and Run. Safe to re-run.
-- ============================================================

-- 1) Extend restaurant_tables with live status + active visit pointer.
alter table restaurant_tables add column if not exists status          text not null default 'available'; -- available|seated|cleaning|disabled
alter table restaurant_tables add column if not exists status_since     timestamptz not null default now(); -- drives the cleaning timer
alter table restaurant_tables add column if not exists active_visit_id  uuid;

-- 2) Per-table capacities for Gepuklah (physical seats per table).
update restaurant_tables t set seats = v.cap
from (values
  ('A1',2),('A2',2),
  ('B1',4),('B2',4),('B3',8),
  ('C1',2),('C2',2),('C3',2),('C4',2),('C5',2),('C6',2),
  ('D1',2),('D2',2),('D3',2),('D4',2),('D5',2),('D6',2),('D7',2),('D8',2),
  ('E1',4),('E2',4)
) as v(id,cap)  -- total = 56 seats
where t.id = v.id;

-- Fresh start for the ops model (clears any legacy occupancy from the old queue page).
update restaurant_tables set status='available', status_since=now(), active_visit_id=null, occupied_by=null;

-- 3) Visits — one customer group's stay (may span multiple tables).
create table if not exists visits (
  id               uuid primary key default gen_random_uuid(),
  queue_entry_id   uuid,
  customer_name    text,
  pax_count        int not null,
  seated_at        timestamptz not null default now(),
  left_at          timestamptz,
  duration_minutes int,
  status           text not null default 'seated',   -- seated|completed|cancelled
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists visits_status_idx on visits(status);
create index if not exists visits_seated_idx on visits(seated_at);

-- 4) Which tables a visit occupies (supports splitting one group across tables).
create table if not exists visit_tables (
  id        uuid primary key default gen_random_uuid(),
  visit_id  uuid not null references visits(id) on delete cascade,
  table_id  text not null references restaurant_tables(id)
);
create index if not exists visit_tables_visit_idx on visit_tables(visit_id);
create index if not exists visit_tables_table_idx on visit_tables(table_id);

-- 5) Lost customers (walked away / couldn't be seated).
create table if not exists lost_customers (
  id             uuid primary key default gen_random_uuid(),
  queue_entry_id uuid,
  pax_count      int not null,
  reason         text,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists lost_customers_created_idx on lost_customers(created_at);

-- 6) Key/value settings (editable in the Settings page).
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value) values
  ('max_capacity','56'),
  ('target_average_duration','45'),
  ('cleaning_minutes','5'),
  ('allow_split_tables','true'),
  ('good_day_target_pax','180'),
  ('target_utilization','70'),
  ('peak_utilization_target','85'),
  ('lost_pax_good_threshold','10'),
  ('lost_pax_bad_threshold','30'),
  ('no_show_good_threshold','5'),
  ('open_hour','10'),
  ('close_hour','22')
on conflict (key) do nothing;

-- 7) Queue entries get timestamps for the richer status set.
alter table queue_entries add column if not exists cancelled_at timestamptz;
alter table queue_entries add column if not exists no_show_at   timestamptz;
alter table queue_entries add column if not exists lost_at      timestamptz;
alter table queue_entries add column if not exists notes        text;
