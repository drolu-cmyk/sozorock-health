BEGIN;

DO $$ BEGIN
  CREATE TYPE evidence.higher_value_meaning AS ENUM (
    'favorable', 'adverse', 'neutral', 'context_dependent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence.source_import_status AS ENUM (
    'running', 'available', 'stale', 'unavailable', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE evidence.measure_definition
  ADD COLUMN IF NOT EXISTS higher_value_meaning evidence.higher_value_meaning
  NOT NULL DEFAULT 'context_dependent';

ALTER TABLE evidence.metric_observation
  ADD COLUMN IF NOT EXISTS source_record_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS geography_level text,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE evidence.metric_observation observation
SET source_record_id = observation.id::text
WHERE source_record_id IS NULL;

UPDATE evidence.metric_observation observation
SET source_url = source.official_url
FROM evidence.source_version source
WHERE observation.source_version_id = source.id
  AND observation.source_url IS NULL;

UPDATE evidence.metric_observation observation
SET geography_level = geography.kind::text
FROM evidence.geography geography
WHERE observation.geography_id = geography.id
  AND observation.geography_level IS NULL;

ALTER TABLE evidence.metric_observation
  ALTER COLUMN source_record_id SET NOT NULL,
  ALTER COLUMN source_url SET NOT NULL,
  ALTER COLUMN geography_level SET NOT NULL;

ALTER TABLE evidence.metric_observation
  ADD CONSTRAINT metric_observation_source_url_https
    CHECK (source_url ~ '^https://'),
  ADD CONSTRAINT metric_observation_geography_level_allowed
    CHECK (geography_level IN (
      'state', 'county', 'census_place', 'zcta', 'postal_zip', 'planning_region',
      'census_tract', 'county_subdivision', 'population_group', 'facility', 'source_designation'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS metric_observation_source_record_idx
  ON evidence.metric_observation (source_version_id, source_record_id, measure_definition_id, geography_id);

CREATE TABLE IF NOT EXISTS evidence.source_import_state (
  id uuid PRIMARY KEY,
  adapter_id text NOT NULL,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  source_version_id uuid REFERENCES evidence.source_version(id),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^sha256:[0-9a-fA-F]{64}$'),
  status evidence.source_import_status NOT NULL,
  attempted_at timestamptz NOT NULL,
  successful_import_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  source_release_label text,
  source_release_date date,
  source_data_period_start date,
  source_data_period_end date,
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_accepted integer NOT NULL DEFAULT 0 CHECK (records_accepted >= 0),
  records_rejected integer NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  observations_published integer NOT NULL DEFAULT 0 CHECK (observations_published >= 0),
  cache_disposition text CHECK (cache_disposition IN ('miss', 'hit', 'revalidated', 'stale_fallback')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_data_period_start IS NULL OR source_data_period_end IS NULL OR source_data_period_start <= source_data_period_end),
  CHECK (records_accepted + records_rejected <= records_read),
  CHECK (status <> 'available' OR successful_import_at IS NOT NULL),
  CHECK (status <> 'failed' OR (failed_at IS NOT NULL AND failure_message IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS source_import_state_source_status_idx
  ON evidence.source_import_state (source_id, status, attempted_at DESC);

CREATE TABLE IF NOT EXISTS evidence.source_http_cache (
  cache_key text PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  official_url text NOT NULL CHECK (official_url ~ '^https://'),
  object_key text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  content_type text,
  etag text,
  last_modified text,
  stored_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (stored_at < expires_at)
);

CREATE INDEX IF NOT EXISTS source_http_cache_source_expiry_idx
  ON evidence.source_http_cache (source_id, expires_at DESC);

COMMIT;
