-- ============================================================
-- Employees table for the HR + Timetable tabs. Paste this whole block into the
-- Supabase SQL Editor (your own project) and Run once. Safe to re-run: it never
-- duplicates or deletes your rows.
-- ============================================================

create table if not exists employees (
  id              bigint generated always as identity primary key,
  name            text not null,
  role            text,
  department      text,
  employment_type text not null default 'full_time',
  status          text not null default 'active',
  hourly_rate     numeric default 0,
  pay_type        text not null default 'hourly',   -- 'hourly' | 'monthly'
  monthly_salary  numeric default 0,
  weekly_hours    numeric default 0,
  work_days       text[] not null default '{Mon,Tue,Wed,Thu,Fri}',
  start_date      date,
  email           text,
  created_at      timestamptz not null default now()
);

-- if the table already existed, make sure the newer columns are there:
alter table employees add column if not exists pay_type       text not null default 'hourly';
alter table employees add column if not exists monthly_salary numeric default 0;
alter table employees add column if not exists work_days       text[] not null default '{Mon,Tue,Wed,Thu,Fri}';

alter table employees enable row level security;

-- seed the current org chart (only inserts if the table is empty)
insert into employees (name, role, department, employment_type, status, pay_type, monthly_salary, hourly_rate, weekly_hours, work_days, start_date, email)
select * from (values
  ('Ming',         'CEO / Founder',                'Management',              'full_time','active','monthly', 0::numeric, 0::numeric,  50::numeric, '{Mon,Tue,Wed,Thu,Fri,Sat}'::text[], date '2023-01-01','ming@gepuklah.com'),
  ('Mel Lee',      'Head of Staff',                'Management',              'full_time','active','monthly', 0, 0,  45, '{Mon,Tue,Wed,Thu,Fri}',     date '2023-06-01','mel@gepuklah.com'),
  ('Amir',         'Head Chef + Supplier Liaison', 'Kitchen',                 'full_time','active','monthly', 0, 0,  48, '{Tue,Wed,Thu,Fri,Sat,Sun}', date '2023-03-01','amir@gepuklah.com'),
  ('Kelly',        'Accountant + Purchasing',      'Finance / Admin',         'full_time','active','monthly', 0, 0,  40, '{Mon,Tue,Wed,Thu,Fri}',     date '2024-02-01','kelly@gepuklah.com'),
  ('Service Crew', 'Full-Time Service Crew',       'Operations / Restaurant', 'full_time','active','hourly',  0, 10, 45, '{Wed,Thu,Fri,Sat,Sun}',     date '2024-01-01','crew@gepuklah.com')
) as seed(name, role, department, employment_type, status, pay_type, monthly_salary, hourly_rate, weekly_hours, work_days, start_date, email)
where not exists (select 1 from employees);
