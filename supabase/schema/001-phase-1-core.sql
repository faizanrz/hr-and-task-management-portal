-- ════════════════════════════════════════════════════════
-- HR Portal — Phase 1 Schema
-- Run this in Supabase SQL Editor FIRST
-- Creates: employees, attendance, leave, payroll, HR docs, announcements
-- ════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Employees (core table, replaces PHP users) ──
create table employees (
  id uuid primary key default uuid_generate_v4(),
  legacy_user_id integer unique, -- maps to old PHP user id during migration
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  email varchar(255) not null unique,
  phone varchar(20),
  role varchar(20) not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  department varchar(50) check (department in ('co-founder', 'creative', 'digital', 'development', 'seo', 'finance', 'operations')),
  job_title varchar(150),
  employment_type varchar(20) default 'full_time' check (employment_type in ('full_time', 'part_time', 'contract')),
  join_date date,
  basic_salary numeric(12,2),
  cnic varchar(15),
  emergency_contact_name varchar(150),
  emergency_contact_phone varchar(20),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Attendance ──
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  check_in time,
  check_out time,
  status varchar(20) default 'present' check (status in ('present', 'absent', 'late', 'half_day', 'on_leave')),
  notes text,
  created_at timestamptz default now(),
  unique (employee_id, date)
);

-- ── Leave Requests ──
create table leave_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type varchar(20) not null check (leave_type in ('annual', 'sick', 'casual', 'unpaid')),
  start_date date not null,
  end_date date not null,
  days_count integer not null,
  reason text,
  status varchar(20) default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references employees(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz default now()
);

-- ── Leave Balances ──
create table leave_balances (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  year integer not null,
  annual_total integer default 8,
  annual_used integer default 0,
  sick_total integer default 4,
  sick_used integer default 0,
  casual_total integer default 3,
  casual_used integer default 0,
  unique (employee_id, year)
);

-- ── Pakistan Public Holidays ──
create table public_holidays (
  id uuid primary key default uuid_generate_v4(),
  name varchar(150) not null,
  date date not null,
  year integer not null
);

-- ── Payroll Records ──
create table payroll_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  basic_salary numeric(12,2) not null,
  allowances numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  bonus numeric(12,2) default 0,
  eobi_deduction numeric(12,2) default 0,
  tax_deduction numeric(12,2) default 0,
  net_salary numeric(12,2) generated always as (basic_salary + allowances + bonus - deductions) stored,
  payment_status varchar(20) default 'pending' check (payment_status in ('pending', 'paid')),
  payment_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (employee_id, month, year)
);

-- ── Salary History ──
create table salary_history (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  effective_date date not null,
  previous_salary numeric(12,2),
  new_salary numeric(12,2) not null,
  change_type varchar(20) check (change_type in ('increment', 'decrement', 'joining')),
  reason text,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz default now()
);

-- ── HR Documents ──
create table hr_documents (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  document_type varchar(50) check (document_type in ('offer_letter', 'contract', 'cnic_copy', 'policy_acknowledgment', 'nda', 'offboarding', 'other')),
  title varchar(255) not null,
  file_path varchar(500) not null,
  file_size integer,
  uploaded_by uuid references employees(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- ── Announcements ──
create table announcements (
  id uuid primary key default uuid_generate_v4(),
  title varchar(255) not null,
  body text not null,
  is_pinned boolean default false,
  posted_by uuid references employees(id) on delete set null,
  expires_at date,
  created_at timestamptz default now()
);

-- ── Profile Edit Requests ──
create table profile_edit_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  requested_changes jsonb not null,
  request_note text,
  status varchar(20) not null default 'pending' check (status in ('pending', 'reviewed', 'rejected')),
  reviewed_by uuid references employees(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ════════════════════════════════════════════════════════
-- Seed: Pakistan Public Holidays 2026
-- ════════════════════════════════════════════════════════
INSERT INTO public_holidays (name, date, year) VALUES
  ('Kashmir Day', '2026-02-05', 2026),
  ('Pakistan Day', '2026-03-23', 2026),
  ('Labour Day', '2026-05-01', 2026),
  ('Eid ul-Fitr Day 1', '2026-03-20', 2026),
  ('Eid ul-Fitr Day 2', '2026-03-21', 2026),
  ('Eid ul-Fitr Day 3', '2026-03-22', 2026),
  ('Eid ul-Adha Day 1', '2026-05-27', 2026),
  ('Eid ul-Adha Day 2', '2026-05-28', 2026),
  ('Eid ul-Adha Day 3', '2026-05-29', 2026),
  ('Shab-e-Meraj', '2026-01-16', 2026),
  ('Shab-e-Barat', '2026-02-01', 2026),
  ('12 Rabi ul-Awal', '2026-09-07', 2026),
  ('Independence Day', '2026-08-14', 2026),
  ('Iqbal Day', '2026-11-09', 2026),
  ('Quaid-e-Azam Day', '2026-12-25', 2026);
