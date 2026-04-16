-- ════════════════════════════════════════════════════════
-- HR Portal — Phase 2 Schema (Task Management)
-- Run AFTER Phase 1 is live and working
-- Creates: boards, clients, board_columns, tasks, comments, statistics
-- Uses integer serial IDs to preserve PHP legacy data
-- ════════════════════════════════════════════════════════

-- ── Boards ──
create table boards (
  id serial primary key,
  name varchar(255) not null,
  description text,
  created_by uuid references employees(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Clients ──
create table clients (
  id serial primary key,
  name varchar(255) not null,
  description text,
  is_active boolean default true,
  created_by uuid references employees(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Board Columns (renamed from "columns" — reserved word in SQL) ──
create table board_columns (
  id serial primary key,
  board_id integer references boards(id) on delete cascade,
  name varchar(100) not null,
  position integer default 0,
  created_at timestamptz default now()
);

-- ── Tasks ──
create table tasks (
  id serial primary key,
  board_id integer references boards(id) on delete cascade,
  column_id integer references board_columns(id),
  client_id integer references clients(id) on delete set null,
  title varchar(255) not null,
  description text,
  position integer default 0,
  owner_id uuid references employees(id),
  assignee_id uuid references employees(id) on delete set null,
  start_date date,
  due_date date,
  completed_at timestamptz,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Task Comments ──
create table task_comments (
  id serial primary key,
  task_id integer references tasks(id) on delete cascade,
  user_id uuid references employees(id),
  comment text not null,
  created_at timestamptz default now()
);

-- ── Task Statistics ──
create table task_statistics (
  user_id uuid references employees(id) on delete cascade,
  client_id integer references clients(id) on delete cascade,
  date date not null,
  tasks_completed integer default 0,
  avg_completion_time float,
  primary key (user_id, client_id, date)
);

-- ── Indexes (match PHP performance indexes) ──
create index idx_tasks_board_column on tasks (board_id, column_id, position);
create index idx_tasks_assignee on tasks (assignee_id, completed_at);
create index idx_tasks_client on tasks (client_id, completed_at);
create index idx_tasks_owner on tasks (owner_id);
create index idx_tasks_due_date on tasks (due_date);
create index idx_tasks_archived on tasks (is_archived);
create index idx_board_columns_position on board_columns (board_id, position);
create index idx_task_comments_task on task_comments (task_id, created_at);
create index idx_task_stats_user_date on task_statistics (user_id, date);
create index idx_task_stats_client_date on task_statistics (client_id, date);
