-- ════════════════════════════════════════════════════════
-- HR Portal — Remove task attachments feature
-- Safe cleanup for databases that previously created the
-- task_attachments table and task-attachments storage bucket.
-- ════════════════════════════════════════════════════════

drop policy if exists "all_read_task_attachments" on public.task_attachments;
drop policy if exists "all_insert_task_attachments" on public.task_attachments;
drop policy if exists "own_delete_task_attachments" on public.task_attachments;
drop policy if exists "admin_delete_task_attachments" on public.task_attachments;

drop table if exists public.task_attachments;

drop policy if exists "task_attachments_read" on storage.objects;
drop policy if exists "task_attachments_insert" on storage.objects;
drop policy if exists "task_attachments_delete" on storage.objects;

-- Supabase does not allow direct deletes from storage.objects/storage.buckets
-- in SQL Editor. If a `task-attachments` bucket was ever created, remove it
-- manually from the Storage UI or with the Storage API.
