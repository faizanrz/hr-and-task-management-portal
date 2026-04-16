-- Update leave policy: 15 days total cap (annual:8, sick:4, casual:3)
-- Update defaults on the table
ALTER TABLE leave_balances
  ALTER COLUMN annual_total SET DEFAULT 8,
  ALTER COLUMN sick_total SET DEFAULT 4,
  ALTER COLUMN casual_total SET DEFAULT 3;

-- Update existing leave_balances rows for 2026 where no leave has been used yet
-- (only reduce totals if nothing has been used, to avoid breaking active balances)
UPDATE leave_balances
SET annual_total = 8, sick_total = 4, casual_total = 3
WHERE year = 2026
  AND annual_used = 0
  AND sick_used = 0
  AND casual_used = 0;

-- For rows with some usage, cap totals but ensure used doesn't exceed total
UPDATE leave_balances
SET
  annual_total = GREATEST(annual_used, 8),
  sick_total = GREATEST(sick_used, 4),
  casual_total = GREATEST(casual_used, 3)
WHERE year = 2026
  AND (annual_used > 0 OR sick_used > 0 OR casual_used > 0);
