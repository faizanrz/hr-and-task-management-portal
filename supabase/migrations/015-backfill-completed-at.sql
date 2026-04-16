-- Backfill completed_at for tasks in Done columns that don't have it set
UPDATE tasks
SET completed_at = updated_at
WHERE completed_at IS NULL
  AND column_id IN (
    SELECT id FROM board_columns WHERE name = 'Done'
  );
