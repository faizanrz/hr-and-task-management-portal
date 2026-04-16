-- ════════════════════════════════════════════════════════
-- HR Portal — Manager scope, salary baseline, profile edit requests
-- Adds missing Phase 1 features and updates RLS accordingly.
-- ════════════════════════════════════════════════════════

alter table public.employees
  add column if not exists basic_salary numeric(12,2);

update public.employees e
set basic_salary = latest.basic_salary
from (
  select distinct on (employee_id)
    employee_id,
    basic_salary
  from public.payroll_records
  order by employee_id, year desc, month desc, created_at desc
) latest
where e.id = latest.employee_id
  and e.basic_salary is null;

create table if not exists public.profile_edit_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_changes jsonb not null,
  request_note text,
  status varchar(20) not null default 'pending' check (status in ('pending', 'reviewed', 'rejected')),
  reviewed_by uuid references public.employees(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profile_edit_requests enable row level security;

create or replace function public.get_user_role()
returns text as $$
  select role from public.employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

create or replace function public.get_employee_id()
returns uuid as $$
  select id from public.employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

create or replace function public.get_user_department()
returns text as $$
  select department from public.employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

drop policy if exists "staff_update_own" on public.employees;

drop policy if exists "admin_all_profile_edit_requests" on public.profile_edit_requests;
drop policy if exists "staff_read_own_profile_edit_requests" on public.profile_edit_requests;
drop policy if exists "staff_insert_own_profile_edit_requests" on public.profile_edit_requests;
create policy "admin_all_profile_edit_requests" on public.profile_edit_requests
  for all using (public.get_user_role() = 'admin');
create policy "staff_read_own_profile_edit_requests" on public.profile_edit_requests
  for select using (employee_id = public.get_employee_id());
create policy "staff_insert_own_profile_edit_requests" on public.profile_edit_requests
  for insert with check (employee_id = public.get_employee_id());

drop policy if exists "manager_read_team_attendance" on public.attendance;
create policy "manager_read_team_attendance" on public.attendance
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

drop policy if exists "manager_read_team_leave" on public.leave_requests;
drop policy if exists "manager_review_team_leave" on public.leave_requests;
create policy "manager_read_team_leave" on public.leave_requests
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );
create policy "manager_review_team_leave" on public.leave_requests
  for update using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  )
  with check (
    employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

drop policy if exists "manager_read_team_balances" on public.leave_balances;
create policy "manager_read_team_balances" on public.leave_balances
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

drop policy if exists "manager_read_team_payroll" on public.payroll_records;
create policy "manager_read_team_payroll" on public.payroll_records
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

drop policy if exists "manager_read_team_salary_history" on public.salary_history;
create policy "manager_read_team_salary_history" on public.salary_history
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );
