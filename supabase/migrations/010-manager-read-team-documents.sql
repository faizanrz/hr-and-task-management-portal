-- ════════════════════════════════════════════════════════
-- Allow managers to read their department's HR documents
-- ════════════════════════════════════════════════════════

create policy "manager_read_team_documents" on hr_documents
  for select using (
    get_user_role() = 'manager'
    and employee_id in (
      select id from employees where department = get_user_department()
    )
  );
