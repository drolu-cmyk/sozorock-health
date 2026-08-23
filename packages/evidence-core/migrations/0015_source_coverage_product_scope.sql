BEGIN;

ALTER TABLE evidence.source_coverage
  ADD COLUMN IF NOT EXISTS coverage_key text NOT NULL DEFAULT 'source:all',
  ADD COLUMN IF NOT EXISTS review_status evidence.review_status NOT NULL DEFAULT 'provisional';

DO $$ BEGIN
  ALTER TABLE evidence.source_coverage
    ADD CONSTRAINT source_coverage_key_format_check
    CHECK (coverage_key ~ '^[a-z0-9][a-z0-9:_-]*$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE evidence.source_coverage
  DROP CONSTRAINT IF EXISTS source_coverage_pkey;

ALTER TABLE evidence.source_coverage
  ADD CONSTRAINT source_coverage_pkey
  PRIMARY KEY (snapshot_id, geography_id, source_id, coverage_key);

DROP INDEX IF EXISTS evidence.source_coverage_status_idx;
CREATE INDEX source_coverage_status_idx
  ON evidence.source_coverage (source_id, coverage_key, status, geography_id);

CREATE INDEX IF NOT EXISTS source_coverage_snapshot_geography_idx
  ON evidence.source_coverage (snapshot_id, geography_id, source_id, coverage_key);

COMMENT ON COLUMN evidence.source_coverage.coverage_key IS
  'Source-product coverage scope. Example: hpsa:primary_care, hpsa:dental, hpsa:mental_health. source:all preserves pre-0015 rows.';

COMMENT ON COLUMN evidence.source_coverage.review_status IS
  'Human/governance review state for this retrieval-coverage assertion. Coverage is not a substantive health finding.';

COMMIT;
