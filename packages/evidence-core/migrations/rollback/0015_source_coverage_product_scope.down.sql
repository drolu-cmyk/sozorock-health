BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM evidence.source_coverage
    GROUP BY snapshot_id, geography_id, source_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot roll back migration 0015: multiple product-level source coverage rows exist for the same snapshot/geography/source. Preserve or migrate those rows explicitly before rollback.';
  END IF;
END $$;

DROP INDEX IF EXISTS evidence.source_coverage_snapshot_geography_idx;
DROP INDEX IF EXISTS evidence.source_coverage_status_idx;

ALTER TABLE evidence.source_coverage
  DROP CONSTRAINT IF EXISTS source_coverage_pkey;

ALTER TABLE evidence.source_coverage
  ADD CONSTRAINT source_coverage_pkey
  PRIMARY KEY (snapshot_id, geography_id, source_id);

CREATE INDEX source_coverage_status_idx
  ON evidence.source_coverage (source_id, status, geography_id);

ALTER TABLE evidence.source_coverage
  DROP CONSTRAINT IF EXISTS source_coverage_key_format_check,
  DROP COLUMN IF EXISTS coverage_key,
  DROP COLUMN IF EXISTS review_status;

COMMIT;
