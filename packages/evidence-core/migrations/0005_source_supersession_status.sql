BEGIN;

ALTER TYPE evidence.source_coverage_status
  ADD VALUE IF NOT EXISTS 'superseded';

COMMIT;
