-- Allow admin, manager, and team_lead to delete tasks and task comments

-- Tasks: replace admin-only delete with team management delete
drop policy if exists "admin_delete_tasks" on public.tasks;
create policy "team_delete_tasks" on public.tasks
  for delete using (public.get_user_role() in ('admin', 'manager', 'team_lead'));

-- Task comments: replace admin-only delete with team management delete
drop policy if exists "admin_delete_task_comments" on public.task_comments;
create policy "team_delete_task_comments" on public.task_comments
  for delete using (
    user_id = public.get_employee_id()
    OR public.get_user_role() in ('admin', 'manager', 'team_lead')
  );
