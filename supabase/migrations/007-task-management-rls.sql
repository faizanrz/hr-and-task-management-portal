-- ════════════════════════════════════════════════════════
-- HR Portal — Phase 2 task management RLS
-- Applies RLS for boards, clients, columns, tasks, comments, stats
-- ════════════════════════════════════════════════════════

create or replace function public.get_user_role()
returns text as $$
  select role from public.employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

create or replace function public.get_employee_id()
returns uuid as $$
  select id from public.employees where email = auth.jwt()->>'email' limit 1;
$$ language sql security definer stable;

alter table public.boards enable row level security;
alter table public.clients enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_statistics enable row level security;

drop policy if exists "all_read_boards" on public.boards;
drop policy if exists "admin_manage_boards" on public.boards;
create policy "all_read_boards" on public.boards
  for select using (true);
create policy "admin_manage_boards" on public.boards
  for all using (public.get_user_role() = 'admin');

drop policy if exists "all_read_clients" on public.clients;
drop policy if exists "admin_manage_clients" on public.clients;
create policy "all_read_clients" on public.clients
  for select using (true);
create policy "admin_manage_clients" on public.clients
  for all using (public.get_user_role() = 'admin');

drop policy if exists "all_read_board_columns" on public.board_columns;
drop policy if exists "admin_manage_board_columns" on public.board_columns;
create policy "all_read_board_columns" on public.board_columns
  for select using (true);
create policy "admin_manage_board_columns" on public.board_columns
  for all using (public.get_user_role() = 'admin');

drop policy if exists "all_read_tasks" on public.tasks;
drop policy if exists "all_insert_tasks" on public.tasks;
drop policy if exists "all_update_tasks" on public.tasks;
drop policy if exists "admin_delete_tasks" on public.tasks;
create policy "all_read_tasks" on public.tasks
  for select using (true);
create policy "all_insert_tasks" on public.tasks
  for insert with check (true);
create policy "all_update_tasks" on public.tasks
  for update using (true);
create policy "admin_delete_tasks" on public.tasks
  for delete using (public.get_user_role() = 'admin');

drop policy if exists "all_read_task_comments" on public.task_comments;
drop policy if exists "all_insert_task_comments" on public.task_comments;
drop policy if exists "own_update_task_comments" on public.task_comments;
drop policy if exists "own_delete_task_comments" on public.task_comments;
drop policy if exists "admin_delete_task_comments" on public.task_comments;
create policy "all_read_task_comments" on public.task_comments
  for select using (true);
create policy "all_insert_task_comments" on public.task_comments
  for insert with check (true);
create policy "own_update_task_comments" on public.task_comments
  for update using (user_id = public.get_employee_id());
create policy "own_delete_task_comments" on public.task_comments
  for delete using (user_id = public.get_employee_id());
create policy "admin_delete_task_comments" on public.task_comments
  for delete using (public.get_user_role() = 'admin');

drop policy if exists "all_read_task_statistics" on public.task_statistics;
drop policy if exists "admin_manage_task_statistics" on public.task_statistics;
create policy "all_read_task_statistics" on public.task_statistics
  for select using (true);
create policy "admin_manage_task_statistics" on public.task_statistics
  for all using (public.get_user_role() = 'admin');
