BEGIN;

CREATE TABLE IF NOT EXISTS evidence.workforce_designation (
  id uuid PRIMARY KEY,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  source_version_id uuid NOT NULL REFERENCES evidence.source_version(id),
  source_record_id text NOT NULL,
  designation_family text NOT NULL CHECK (designation_family IN ('hpsa', 'mua_p')),
  discipline text NOT NULL,
  designation_name text NOT NULL,
  designation_type text,
  component_type text,
  status text NOT NULL,
  score numeric,
  designation_date date,
  last_update_date date,
  whole_county boolean NOT NULL,
  source_scope text NOT NULL CHECK (source_scope IN (
    'whole_county', 'subcounty', 'population_group', 'facility', 'other'
  )),
  review_status evidence.review_status NOT NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_version_id, source_record_id, geography_id)
);

CREATE INDEX IF NOT EXISTS workforce_designation_geography_idx
  ON evidence.workforce_designation (geography_id, designation_family, status);

COMMIT;
