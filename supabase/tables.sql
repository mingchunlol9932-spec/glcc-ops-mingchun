-- ============================================================
-- Restaurant tables  (floor layout for the Queue tab)
-- Paste into Supabase SQL Editor and Run. Safe to re-run:
-- existing rows are updated in place, new ones added.
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

-- Current floor plan (56 pax):
--   A1,A2        2-pax
--   B1,B2 round 4-pax · B3 long communal 8-pax
--   C1..C6       2-pax square (combine for bigger parties)
--   D1..D8       2-pax square (combine for bigger parties)
--   E1,E2 round  4-pax
insert into restaurant_tables (id, zone, label, seats, sort) values
  ('A1','A','A1',2,10), ('A2','A','A2',2,11),
  ('B1','B','B1',4,20), ('B2','B','B2',4,21), ('B3','B','B3',8,22),
  ('C1','C','C1',2,30), ('C2','C','C2',2,31), ('C3','C','C3',2,32),
  ('C4','C','C4',2,33), ('C5','C','C5',2,34), ('C6','C','C6',2,35),
  ('D1','D','D1',2,40), ('D2','D','D2',2,41), ('D3','D','D3',2,42), ('D4','D','D4',2,43),
  ('D5','D','D5',2,44), ('D6','D','D6',2,45), ('D7','D','D7',2,46), ('D8','D','D8',2,47),
  ('E1','E','E1',4,50), ('E2','E','E2',4,51)
on conflict (id) do update set
  zone = excluded.zone, label = excluded.label, seats = excluded.seats, sort = excluded.sort;
