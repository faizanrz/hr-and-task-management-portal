-- Fix manager and team_lead RLS policies to match updated role scoping
-- Manager: sees all employees except co-founder
-- Team Lead: sees own department only

-- ── Attendance ──
drop policy if exists "manager_read_team_attendance" on public.attendance;
create policy "manager_read_all_attendance" on public.attendance
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department != 'co-founder'
    )
  );

drop policy if exists "team_lead_read_team_attendance" on public.attendance;
create policy "team_lead_read_team_attendance" on public.attendance
  for select using (
    public.get_user_role() = 'team_lead'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

-- ── Leave Requests ──
drop policy if exists "manager_read_team_leave" on public.leave_requests;
create policy "manager_read_all_leave" on public.leave_requests
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department != 'co-founder'
    )
  );

drop policy if exists "team_lead_read_team_leave" on public.leave_requests;
create policy "team_lead_read_team_leave" on public.leave_requests
  for select using (
    public.get_user_role() = 'team_lead'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

drop policy if exists "manager_review_team_leave" on public.leave_requests;
create policy "manager_review_all_leave" on public.leave_requests
  for update using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department != 'co-founder'
    )
  );

drop policy if exists "team_lead_review_team_leave" on public.leave_requests;
create policy "team_lead_review_team_leave" on public.leave_requests
  for update using (
    public.get_user_role() = 'team_lead'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );

-- ── HR Documents ──
drop policy if exists "manager_read_team_documents" on public.hr_documents;
create policy "manager_read_all_documents" on public.hr_documents
  for select using (
    public.get_user_role() = 'manager'
    and employee_id in (
      select id from public.employees where department != 'co-founder'
    )
  );

drop policy if exists "team_lead_read_team_documents" on public.hr_documents;
create policy "team_lead_read_team_documents" on public.hr_documents
  for select using (
    public.get_user_role() = 'team_lead'
    and employee_id in (
      select id from public.employees where department = public.get_user_department()
    )
  );
