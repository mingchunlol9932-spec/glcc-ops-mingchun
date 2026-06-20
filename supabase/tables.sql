-- ============================================================
-- Restaurant tables  (floor layout for the Queue tab)
-- Paste into Supabase SQL Editor and Run. Safe to re-run.
-- A table is "free" when occupied_by is NULL.
-- ============================================================

create table if not exists restaurant_tables (
  id          text primary key,        -- e.g. 'A1'
  zone        text not null,           -- 'A'..'E'
  label       text not null,           -- shown to staff, e.g. 'A1'
  seats       int  not null,
  sort        int  not null default 0,
  occupied_by uuid references queue_entries(id) on delete set null
);

-- Seed the current floor plan (56 pax). on conflict = safe to re-run.
insert into restaurant_tables (id, zone, label, seats, sort) values
  ('A1','A','A1',2,10), ('A2','A','A2',2,11),
  ('B1','B','B1',4,20), ('B2','B','B2',4,21), ('B3','B','B3',8,22),
  ('C1','C','C1',6,30), ('C2','C','C2',6,31),
  ('D1','D','D1',4,40), ('D2','D','D2',4,41), ('D3','D','D3',4,42), ('D4','D','D4',4,43),
  ('E1','E','E1',4,50), ('E2','E','E2',4,51)
on conflict (id) do nothing;
