BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS evidence;

DO $$ BEGIN
  CREATE TYPE evidence.review_status AS ENUM (
    'verified', 'provisional', 'stale', 'unavailable', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence.geography_kind AS ENUM (
    'state', 'county', 'census_place', 'zcta', 'postal_zip', 'planning_region'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence.metric_direction AS ENUM (
    'adverse', 'protective', 'contextual', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS evidence.source_catalog (
  id text PRIMARY KEY,
  family text NOT NULL CHECK (family IN (
    'census_geography', 'cdc_places', 'acs', 'hrsa', 'ahrq_clh', 'local_planning_document'
  )),
  publisher text NOT NULL,
  title text NOT NULL,
  official_url text NOT NULL CHECK (official_url ~ '^https://'),
  host_policy text NOT NULL CHECK (host_policy IN ('fixed_allowlist', 'reviewer_approved_per_document')),
  allowed_hosts text[] NOT NULL,
  refresh_cadence text NOT NULL CHECK (refresh_cadence IN (
    'annual', 'release_based', 'daily', 'monthly_review', 'manual'
  )),
  geography_kinds evidence.geography_kind[] NOT NULL,
  review_status evidence.review_status NOT NULL,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (host_policy = 'reviewer_approved_per_document' OR cardinality(allowed_hosts) > 0)
);

CREATE TABLE IF NOT EXISTS evidence.source_version (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  release_label text NOT NULL,
  release_date date NOT NULL,
  data_period_start date,
  data_period_end date,
  retrieved_at timestamptz NOT NULL,
  stale_after timestamptz NOT NULL,
  official_url text NOT NULL CHECK (official_url ~ '^https://'),
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  schema_version text NOT NULL,
  review_status evidence.review_status NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, release_label, content_hash),
  CHECK (data_period_start IS NULL OR data_period_end IS NULL OR data_period_start <= data_period_end),
  CHECK (review_status <> 'verified' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS evidence.geography (
  id uuid PRIMARY KEY,
  kind evidence.geography_kind NOT NULL,
  authority text NOT NULL CHECK (authority IN ('census', 'usps', 'state', 'local', 'regional')),
  authority_id text NOT NULL,
  name text NOT NULL,
  display_name text NOT NULL,
  state_fips char(2),
  county_fips char(5),
  vintage text NOT NULL,
  valid_from date,
  valid_to date,
  review_status evidence.review_status NOT NULL,
  caveat text,
  geom geometry(Geometry, 4326),
  point_on_surface geometry(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, authority, authority_id, vintage),
  CHECK (state_fips IS NULL OR state_fips ~ '^[0-9]{2}$'),
  CHECK (county_fips IS NULL OR county_fips ~ '^[0-9]{5}$'),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to),
  CHECK (kind <> 'county' OR county_fips::text = authority_id),
  CHECK (kind <> 'zcta' OR authority_id ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS geography_geom_gix ON evidence.geography USING gist (geom);
CREATE INDEX IF NOT EXISTS geography_kind_authority_idx ON evidence.geography (kind, authority_id);
CREATE INDEX IF NOT EXISTS geography_state_county_idx ON evidence.geography (state_fips, county_fips);

CREATE TABLE IF NOT EXISTS evidence.geography_alias (
  id uuid PRIMARY KEY,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  alias_type text NOT NULL CHECK (alias_type IN ('official', 'postal', 'common', 'former', 'search')),
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  review_status evidence.review_status NOT NULL,
  UNIQUE (geography_id, normalized_alias, alias_type, source_version_id)
);

CREATE INDEX IF NOT EXISTS geography_alias_search_idx ON evidence.geography_alias (normalized_alias);

CREATE TABLE IF NOT EXISTS evidence.geography_relationship (
  id uuid PRIMARY KEY,
  from_geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  to_geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  relationship_kind text NOT NULL CHECK (relationship_kind IN (
    'contains', 'intersects', 'overlaps', 'approximates', 'member_of', 'plan_applies_to'
  )),
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  vintage text NOT NULL,
  overlap_area_percent numeric(7,4),
  overlap_population_percent numeric(7,4),
  method text NOT NULL,
  caveat text,
  review_status evidence.review_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_geography_id, to_geography_id, relationship_kind, source_version_id),
  CHECK (from_geography_id <> to_geography_id),
  CHECK (overlap_area_percent IS NULL OR overlap_area_percent BETWEEN 0 AND 100),
  CHECK (overlap_population_percent IS NULL OR overlap_population_percent BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS geography_relationship_from_idx
  ON evidence.geography_relationship (from_geography_id, relationship_kind);
CREATE INDEX IF NOT EXISTS geography_relationship_to_idx
  ON evidence.geography_relationship (to_geography_id, relationship_kind);

CREATE TABLE IF NOT EXISTS evidence.measure_definition (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  source_measure_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  direction evidence.metric_direction NOT NULL,
  unit text NOT NULL CHECK (unit IN ('percent', 'count', 'rate', 'ratio', 'index', 'designation')),
  universe text NOT NULL,
  adjustment text NOT NULL CHECK (adjustment IN ('crude', 'age_adjusted', 'modeled', 'not_applicable')),
  comparison_policy text NOT NULL CHECK (comparison_policy IN (
    'higher_is_concern', 'lower_is_concern', 'context_only', 'not_rankable'
  )),
  review_status evidence.review_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_measure_id)
);

CREATE TABLE IF NOT EXISTS evidence.metric_observation (
  id uuid PRIMARY KEY,
  measure_definition_id uuid NOT NULL REFERENCES evidence.measure_definition(id),
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  value_json jsonb,
  numeric_value numeric,
  confidence_low numeric,
  confidence_high numeric,
  margin_of_error numeric,
  release_date date NOT NULL,
  data_period_start date,
  data_period_end date,
  retrieved_at timestamptz NOT NULL,
  review_status evidence.review_status NOT NULL,
  suppression_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (measure_definition_id, geography_id, source_version_id, data_period_start, data_period_end),
  CHECK (confidence_low IS NULL OR confidence_high IS NULL OR confidence_low <= confidence_high),
  CHECK (data_period_start IS NULL OR data_period_end IS NULL OR data_period_start <= data_period_end),
  CHECK (numeric_value IS NOT NULL OR value_json IS NOT NULL OR suppression_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS metric_observation_place_idx
  ON evidence.metric_observation (geography_id, measure_definition_id, release_date DESC);

CREATE TABLE IF NOT EXISTS evidence.planning_document (
  id uuid PRIMARY KEY,
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  document_type text NOT NULL CHECK (document_type IN (
    'cha', 'chip', 'chna', 'csp', 'implementation_strategy', 'supporting_report'
  )),
  title text NOT NULL,
  publisher text NOT NULL,
  official_url text NOT NULL CHECK (official_url ~ '^https://'),
  published_at date,
  period_start date,
  period_end date,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  review_status evidence.review_status NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  supersedes_document_id uuid REFERENCES evidence.planning_document(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start IS NULL OR period_end IS NULL OR period_start <= period_end),
  CHECK (review_status <> 'verified' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS evidence.planning_document_geography (
  document_id uuid NOT NULL REFERENCES evidence.planning_document(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  relationship_kind text NOT NULL CHECK (relationship_kind IN ('applies_to', 'includes', 'references')),
  review_status evidence.review_status NOT NULL,
  PRIMARY KEY (document_id, geography_id, relationship_kind)
);

CREATE TABLE IF NOT EXISTS evidence.evidence_claim (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES evidence.planning_document(id) ON DELETE CASCADE,
  claim_type text NOT NULL CHECK (claim_type IN ('priority', 'finding', 'barrier', 'asset', 'action', 'data_gap')),
  statement text NOT NULL,
  exact_excerpt text NOT NULL,
  extraction_method text NOT NULL CHECK (extraction_method IN ('human', 'ocr', 'structured_parser', 'model_assisted')),
  confidence text NOT NULL CHECK (confidence IN ('high', 'moderate', 'low')),
  review_status evidence.review_status NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (review_status <> 'verified' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS evidence.evidence_claim_geography (
  claim_id uuid NOT NULL REFERENCES evidence.evidence_claim(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  PRIMARY KEY (claim_id, geography_id)
);

CREATE TABLE IF NOT EXISTS evidence.evidence_citation (
  id uuid PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES evidence.evidence_claim(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES evidence.planning_document(id) ON DELETE CASCADE,
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  section text,
  paragraph text,
  source_field text,
  quoted_text text NOT NULL,
  quoted_text_hash text NOT NULL CHECK (quoted_text_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  locator_bounding_box jsonb,
  review_status evidence.review_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (page_number IS NOT NULL OR section IS NOT NULL OR source_field IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS evidence_citation_claim_idx ON evidence.evidence_citation (claim_id);

CREATE TABLE IF NOT EXISTS evidence.ingestion_run (
  id uuid PRIMARY KEY,
  adapter_id text NOT NULL,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('started', 'validated', 'published', 'failed', 'quarantined')),
  input_hash text,
  output_hash text,
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_accepted integer NOT NULL DEFAULT 0 CHECK (records_accepted >= 0),
  records_rejected integer NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (records_accepted + records_rejected <= records_read)
);

CREATE TABLE IF NOT EXISTS evidence.evidence_snapshot (
  id uuid PRIMARY KEY,
  contract_version text NOT NULL,
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL,
  published_at timestamptz,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  review_status evidence.review_status NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  CHECK (review_status <> 'verified' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS evidence.snapshot_source_version (
  snapshot_id uuid NOT NULL REFERENCES evidence.evidence_snapshot(id) ON DELETE CASCADE,
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  PRIMARY KEY (snapshot_id, source_version_id)
);

CREATE TABLE IF NOT EXISTS evidence.response_cache (
  cache_key text PRIMARY KEY,
  contract_version text NOT NULL,
  evidence_snapshot_id uuid NOT NULL REFERENCES evidence.evidence_snapshot(id),
  policy_version text NOT NULL,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (created_at < expires_at)
);

CREATE TABLE IF NOT EXISTS evidence.audit_event (
  id uuid PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'reviewed', 'published', 'staled', 'rejected')),
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'human')),
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL,
  before_hash text,
  after_hash text
);

CREATE INDEX IF NOT EXISTS audit_event_entity_idx
  ON evidence.audit_event (entity_type, entity_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION evidence.prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'evidence.audit_event is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_event_append_only ON evidence.audit_event;
CREATE TRIGGER audit_event_append_only
BEFORE UPDATE OR DELETE ON evidence.audit_event
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_audit_mutation();

COMMIT;
