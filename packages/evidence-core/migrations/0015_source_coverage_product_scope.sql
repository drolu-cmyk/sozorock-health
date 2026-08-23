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

CREATE OR REPLACE FUNCTION evidence.normalize_source_coverage_review_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_review evidence.review_status;
BEGIN
  IF NEW.review_status = 'provisional' THEN
    IF NEW.status = 'stale' THEN
      NEW.review_status := 'stale';
    ELSIF NEW.status IN (
      'unavailable_from_source',
      'credential_blocked',
      'ingestion_failed',
      'incompatible_geography'
    ) THEN
      NEW.review_status := 'unavailable';
    ELSIF NEW.status IN ('available', 'partially_available')
      AND NEW.source_version_id IS NOT NULL THEN
      SELECT sv.review_status
        INTO source_review
        FROM evidence.source_version sv
       WHERE sv.id = NEW.source_version_id;
      IF source_review = 'verified' THEN
        NEW.review_status := 'verified';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS source_coverage_review_status_normalize
  ON evidence.source_coverage;
CREATE TRIGGER source_coverage_review_status_normalize
BEFORE INSERT OR UPDATE OF status, source_version_id, review_status
ON evidence.source_coverage
FOR EACH ROW EXECUTE FUNCTION evidence.normalize_source_coverage_review_status();

UPDATE evidence.source_coverage coverage
SET review_status = CASE
  WHEN coverage.status = 'stale' THEN 'stale'::evidence.review_status
  WHEN coverage.status IN (
    'unavailable_from_source',
    'credential_blocked',
    'ingestion_failed',
    'incompatible_geography'
  ) THEN 'unavailable'::evidence.review_status
  WHEN coverage.status IN ('available', 'partially_available')
    AND EXISTS (
      SELECT 1
      FROM evidence.source_version source_version
      WHERE source_version.id = coverage.source_version_id
        AND source_version.review_status = 'verified'
    ) THEN 'verified'::evidence.review_status
  ELSE coverage.review_status
END
WHERE coverage.review_status = 'provisional';

COMMENT ON COLUMN evidence.source_coverage.coverage_key IS
  'Source-product coverage scope. Example: hpsa:primary_care, hpsa:dental, hpsa:mental_health. source:all preserves pre-0015 rows.';

COMMENT ON COLUMN evidence.source_coverage.review_status IS
  'Human/governance review state for this retrieval-coverage assertion. Coverage is not a substantive health finding.';

COMMIT;
