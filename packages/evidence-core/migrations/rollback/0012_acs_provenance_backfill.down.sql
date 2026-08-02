BEGIN;

-- A data-correction backfill is not safely reversible without a row-level
-- before-image. Keep the schema intact and require an explicit reviewed
-- correction if a deployment must be reverted.
SELECT 1;

COMMIT;
