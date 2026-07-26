BEGIN;

DO $$ BEGIN
  CREATE TYPE evidence.source_coverage_status AS ENUM (
    'available',
    'partially_available',
    'unavailable_from_source',
    'credential_blocked',
    'ingestion_failed',
    'stale',
    'incompatible_geography',
    'awaiting_human_review',
    'not_yet_verified'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE evidence.geography
  ADD COLUMN IF NOT EXISTS legal_statistical_area_code text,
  ADD COLUMN IF NOT EXISTS geography_type_label text,
  ADD COLUMN IF NOT EXISTS release_scope text NOT NULL DEFAULT 'primary_50_states_dc',
  ADD COLUMN IF NOT EXISTS geometry_source_url text,
  ADD COLUMN IF NOT EXISTS geometry_status text NOT NULL DEFAULT 'metadata_only',
  ADD COLUMN IF NOT EXISTS land_area_square_meters numeric,
  ADD COLUMN IF NOT EXISTS water_area_square_meters numeric;

ALTER TABLE evidence.geography
  DROP CONSTRAINT IF EXISTS geography_release_scope_check,
  ADD CONSTRAINT geography_release_scope_check CHECK (
    release_scope IN ('primary_50_states_dc', 'extended_territory')
  ),
  DROP CONSTRAINT IF EXISTS geography_geometry_status_check,
  ADD CONSTRAINT geography_geometry_status_check CHECK (
    geometry_status IN ('polygon_loaded', 'metadata_only', 'unavailable_from_official_vintage')
  ),
  DROP CONSTRAINT IF EXISTS geography_geometry_source_https,
  ADD CONSTRAINT geography_geometry_source_https CHECK (
    geometry_source_url IS NULL OR geometry_source_url ~ '^https://'
  );

CREATE INDEX IF NOT EXISTS geography_release_scope_idx
  ON evidence.geography (release_scope, kind, authority_id);

CREATE TABLE IF NOT EXISTS evidence.source_coverage (
  snapshot_id uuid NOT NULL REFERENCES evidence.evidence_snapshot(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  source_version_id uuid REFERENCES evidence.source_version(id),
  status evidence.source_coverage_status NOT NULL,
  reason text NOT NULL,
  observed_at timestamptz NOT NULL,
  data_period_start date,
  data_period_end date,
  observation_count integer NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (snapshot_id, geography_id, source_id),
  CHECK (data_period_start IS NULL OR data_period_end IS NULL OR data_period_start <= data_period_end),
  CHECK (status NOT IN ('available', 'partially_available') OR source_version_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS source_coverage_status_idx
  ON evidence.source_coverage (source_id, status, geography_id);

CREATE TABLE IF NOT EXISTS evidence.import_manifest (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  source_version_id uuid REFERENCES evidence.source_version(id),
  ingestion_run_id uuid REFERENCES evidence.ingestion_run(id),
  artifact_url text NOT NULL CHECK (artifact_url ~ '^https://'),
  artifact_object_key text NOT NULL,
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-fA-F]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  record_count bigint NOT NULL CHECK (record_count >= 0),
  schema_version text NOT NULL,
  imported_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^sha256:[0-9a-fA-F]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS evidence.source_health_event (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  status evidence.source_coverage_status NOT NULL,
  checked_at timestamptz NOT NULL,
  response_code integer,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  last_successful_import_at timestamptz,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS source_health_source_time_idx
  ON evidence.source_health_event (source_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS evidence.execution_audit (
  id uuid PRIMARY KEY,
  execution_type text NOT NULL CHECK (execution_type IN (
    'public_brief', 'internal_agent', 'partner_brief', 'comparison', 'refresh'
  )),
  contract_version text NOT NULL,
  policy_version text NOT NULL,
  snapshot_id uuid REFERENCES evidence.evidence_snapshot(id),
  geography_id uuid REFERENCES evidence.geography(id),
  request_hash text NOT NULL CHECK (request_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  response_hash text CHECK (response_hash IS NULL OR response_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'rejected', 'failed')),
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS execution_audit_geography_time_idx
  ON evidence.execution_audit (geography_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS evidence.capability_switch (
  capability_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence.schema_migration (
  migration_name text PRIMARY KEY,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
  applied_at timestamptz NOT NULL,
  applied_by text NOT NULL
);

INSERT INTO evidence.capability_switch (capability_key, enabled, reason, updated_at, updated_by)
VALUES
  ('source:census_geography', true, 'Required canonical geography source.', now(), 'migration:0004'),
  ('source:cdc_places', true, 'Approved snapshot reads are enabled; live public reads are prohibited.', now(), 'migration:0004'),
  ('source:acs', true, 'Approved snapshot reads are enabled; refresh requires configured credentials when requested.', now(), 'migration:0004'),
  ('source:hrsa', true, 'Approved snapshot reads are enabled.', now(), 'migration:0004'),
  ('source:ahrq_clh', false, 'Disabled until the approved workbook and codebook pass import validation.', now(), 'migration:0004'),
  ('narrative_generation', false, 'Public narrative generation remains disabled pending a separate release gate.', now(), 'migration:0004')
ON CONFLICT (capability_key) DO NOTHING;

CREATE OR REPLACE FUNCTION evidence.prevent_immutable_record_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS import_manifest_append_only ON evidence.import_manifest;
CREATE TRIGGER import_manifest_append_only
BEFORE UPDATE OR DELETE ON evidence.import_manifest
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS execution_audit_append_only ON evidence.execution_audit;
CREATE TRIGGER execution_audit_append_only
BEFORE UPDATE OR DELETE ON evidence.execution_audit
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS evidence_snapshot_append_only ON evidence.evidence_snapshot;
CREATE TRIGGER evidence_snapshot_append_only
BEFORE UPDATE OR DELETE ON evidence.evidence_snapshot
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS schema_migration_append_only ON evidence.schema_migration;
CREATE TRIGGER schema_migration_append_only
BEFORE UPDATE OR DELETE ON evidence.schema_migration
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

COMMIT;
