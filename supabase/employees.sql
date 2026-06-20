-- ============================================================
-- HR — the employees table for the HR tab. Paste this whole block into the
-- Supabase SQL Editor (your own project) and Run once. Safe to re-run: it
-- never duplicates or deletes your rows.
-- ============================================================

create table if not exists employees (
  id              bigint generated always as identity primary key,
  name            text        not null,                 -- "Sarah Lim"
  role            text,                                  -- "Frontend Developer"
  department      text,                                  -- "Engineering"
  employment_type text        not null default 'full_time', -- full_time | part_time
  status          text        not null default 'active',    -- active | on_leave | probation | left
  hourly_rate     numeric     default 0,                 -- RM per hour
  weekly_hours    numeric     default 0,                 -- contracted hours per week
  start_date      date,
  email           text,
  created_at      timestamptz not null default now()
);

-- Weekly work pattern for the Timetable tab. Defaults to Mon–Fri; the part-time
-- staff get their own days in the UPDATEs at the bottom. Safe to re-run.
alter table employees add column if not exists work_days text[] not null default '{Mon,Tue,Wed,Thu,Fri}';

-- Server-side only: your Next.js app reads this with the SERVICE_ROLE key,
-- which bypasses RLS. No public/anon access.
alter table employees enable row level security;

-- SEED — 10 sample team members (7 full-time, 3 part-time). The `where not
-- exists` guard means re-running this file never creates duplicates.
insert into employees (name, role, department, employment_type, status, hourly_rate, weekly_hours, start_date, email)
select * from (values
  ('Sarah Lim',    'Engineering Manager', 'Engineering', 'full_time', 'active',    55, 40, date '2023-02-01', 'sarah@company.com'),
  ('Daniel Wong',  'Frontend Developer',  'Engineering', 'full_time', 'active',    38, 40, date '2024-06-15', 'daniel@company.com'),
  ('Aisha Rahman', 'Product Designer',    'Product',     'full_time', 'on_leave',  35, 40, date '2023-09-01', 'aisha@company.com'),
  ('Kumar Raj',    'Sales Executive',     'Sales',       'full_time', 'probation', 28, 40, date '2026-05-01', 'kumar@company.com'),
  ('Mei Ling',     'Content Writer',      'Marketing',   'part_time', 'active',    25, 20, date '2025-03-10', 'mei@company.com'),
  ('Arjun Patel',  'Data Analyst',        'Engineering', 'full_time', 'active',    40, 40, date '2024-11-20', 'arjun@company.com'),
  ('Nurul Huda',   'HR Executive',        'People Ops',  'full_time', 'active',    30, 40, date '2023-07-05', 'nurul@company.com'),
  ('Jason Tan',    'Customer Support',    'Support',     'part_time', 'active',    20, 24, date '2025-08-01', 'jason@company.com'),
  ('Priya Nair',   'Accountant',          'Finance',     'full_time', 'active',    36, 40, date '2024-01-12', 'priya@company.com'),
  ('Faizal Omar',  'Social Media Intern', 'Marketing',   'part_time', 'probation', 15, 16, date '2026-04-15', 'faizal@company.com')
) as seed(name, role, department, employment_type, status, hourly_rate, weekly_hours, start_date, email)
where not exists (select 1 from employees);

-- Part-time staff work specific days (full-timers keep the Mon–Fri default).
update employees set work_days = '{Mon,Wed,Fri}'     where name = 'Mei Ling';
update employees set work_days = '{Thu,Fri,Sat,Sun}' where name = 'Jason Tan';
update employees set work_days = '{Tue,Thu}'         where name = 'Faizal Omar';
