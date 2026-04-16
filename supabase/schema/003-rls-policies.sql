-- ════════════════════════════════════════════════════════
-- HR Portal — Row Level Security Policies
-- Run AFTER schema tables are created
-- ════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table employees enable row level security;
alter table attendance enable row level security;
alter table leave_requests enable row level security;
alter table leave_balances enable row level security;
alter table public_holidays enable row level security;
alter table payroll_records enable row level security;
alter table salary_history enable row level security;
alter table hr_documents enable row level security;
alter table announcements enable row level security;
alter table profile_edit_requests enable row level security;

-- ── Helper: get current user's role ──
create or replace function get_user_role()
returns text as $$
  select role from employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

-- ── Helper: get current user's employee ID ──
create or replace function get_employee_id()
returns uuid as $$
  select id from employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

create or replace function get_user_department()
returns text as $$
  select department from employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

-- ══ EMPLOYEES ══
-- Admin: full access
create policy "admin_all_employees" on employees
  for all using (get_user_role() = 'admin');

-- Staff/Manager: read all (directory), update own record
create policy "staff_read_employees" on employees
  for select using (true);

-- ══ ATTENDANCE ══
create policy "admin_all_attendance" on attendance
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_attendance" on attendance
  for select using (employee_id = get_employee_id());

create policy "manager_read_team_attendance" on attendance
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );

create policy "staff_insert_own_attendance" on attendance
  for insert with check (employee_id = get_employee_id());

create policy "staff_update_own_attendance" on attendance
  for update using (employee_id = get_employee_id());

-- ══ LEAVE REQUESTS ══
create policy "admin_all_leave" on leave_requests
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_leave" on leave_requests
  for select using (employee_id = get_employee_id());

create policy "staff_insert_own_leave" on leave_requests
  for insert with check (employee_id = get_employee_id());

create policy "manager_read_team_leave" on leave_requests
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );

create policy "manager_review_team_leave" on leave_requests
  for update using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  )
  with check (
    employee_id in (
      select id from employees where department = get_user_department()
    )
  );

-- ══ LEAVE BALANCES ══
create policy "admin_all_balances" on leave_balances
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_balance" on leave_balances
  for select using (employee_id = get_employee_id());

create policy "manager_read_team_balances" on leave_balances
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );

-- ══ PUBLIC HOLIDAYS ══
create policy "all_read_holidays" on public_holidays
  for select using (true);

create policy "admin_manage_holidays" on public_holidays
  for all using (get_user_role() = 'admin');

-- ══ PAYROLL ══
create policy "admin_all_payroll" on payroll_records
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_payroll" on payroll_records
  for select using (employee_id = get_employee_id());

create policy "manager_read_team_payroll" on payroll_records
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );

-- ══ SALARY HISTORY ══
create policy "admin_all_salary_history" on salary_history
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_salary_history" on salary_history
  for select using (employee_id = get_employee_id());

create policy "manager_read_team_salary_history" on salary_history
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );

-- ══ HR DOCUMENTS ══
create policy "admin_all_documents" on hr_documents
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_documents" on hr_documents
  for select using (employee_id = get_employee_id());

create policy "manager_read_team_documents" on hr_documents
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );

-- ══ ANNOUNCEMENTS ══
create policy "all_read_announcements" on announcements
  for select using (true);

create policy "admin_manage_announcements" on announcements
  for all using (get_user_role() = 'admin');

-- ══ PROFILE EDIT REQUESTS ══
create policy "admin_all_profile_edit_requests" on profile_edit_requests
  for all using (get_user_role() = 'admin');

create policy "staff_read_own_profile_edit_requests" on profile_edit_requests
  for select using (employee_id = get_employee_id());

create policy "staff_insert_own_profile_edit_requests" on profile_edit_requests
  for insert with check (employee_id = get_employee_id());

-- ════════════════════════════════════════════════════════
-- Phase 2: Task Management RLS Policies
-- ════════════════════════════════════════════════════════

-- Enable RLS on Phase 2 tables
alter table boards enable row level security;
alter table clients enable row level security;
alter table board_columns enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_statistics enable row level security;

-- ══ BOARDS ══
-- Everyone can read boards
create policy "all_read_boards" on boards
  for select using (true);

-- Admin: full access (create/update/delete)
create policy "admin_manage_boards" on boards
  for all using (get_user_role() = 'admin');

-- ══ CLIENTS ══
-- Everyone can read clients
create policy "all_read_clients" on clients
  for select using (true);

-- Admin: full access (create/update/delete)
create policy "admin_manage_clients" on clients
  for all using (get_user_role() = 'admin');

-- ══ BOARD COLUMNS ══
-- Everyone can read board columns
create policy "all_read_board_columns" on board_columns
  for select using (true);

-- Admin: full access
create policy "admin_manage_board_columns" on board_columns
  for all using (get_user_role() = 'admin');

-- ══ TASKS ══
-- Everyone can read all tasks
create policy "all_read_tasks" on tasks
  for select using (true);

-- Everyone can create tasks
create policy "all_insert_tasks" on tasks
  for insert with check (true);

-- Everyone can update tasks (move, edit)
create policy "all_update_tasks" on tasks
  for update using (true);

-- Admin can delete tasks
create policy "admin_delete_tasks" on tasks
  for delete using (get_user_role() = 'admin');

-- ══ TASK COMMENTS ══
-- Everyone can read comments
create policy "all_read_task_comments" on task_comments
  for select using (true);

-- Everyone can insert comments
create policy "all_insert_task_comments" on task_comments
  for insert with check (true);

-- Users can update their own comments
create policy "own_update_task_comments" on task_comments
  for update using (user_id = get_employee_id());

-- Users can delete their own comments
create policy "own_delete_task_comments" on task_comments
  for delete using (user_id = get_employee_id());

-- Admin can delete any comment
create policy "admin_delete_task_comments" on task_comments
  for delete using (get_user_role() = 'admin');

-- ══ TASK STATISTICS ══
-- Everyone can read statistics
create policy "all_read_task_statistics" on task_statistics
  for select using (true);

-- Admin: full access
create policy "admin_manage_task_statistics" on task_statistics
  for all using (get_user_role() = 'admin');
