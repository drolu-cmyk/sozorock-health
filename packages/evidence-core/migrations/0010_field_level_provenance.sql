BEGIN;

-- ACS and other derived public measures need reproducible field-level
-- provenance.  These columns supplement source_metadata without replacing the
-- original source payload. Existing rows are intentionally not fabricated;
-- rows without verified provenance remain incomplete until reviewed.
ALTER TABLE evidence.metric_observation
  ADD COLUMN IF NOT EXISTS source_variable_id text,
  ADD COLUMN IF NOT EXISTS source_numerator_variable_id text,
  ADD COLUMN IF NOT EXISTS source_denominator_variable_id text,
  ADD COLUMN IF NOT EXISTS source_formula text,
  ADD COLUMN IF NOT EXISTS source_transformation_version text,
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_group text,
  ADD COLUMN IF NOT EXISTS source_estimate_field text,
  ADD COLUMN IF NOT EXISTS source_margin_of_error_field text;

UPDATE evidence.metric_observation observation
SET source_variable_id = NULLIF(observation.source_metadata->>'variableId', '')
WHERE source_variable_id IS NULL
  AND observation.source_metadata ? 'variableId';

UPDATE evidence.metric_observation observation
SET source_margin_of_error_field = NULLIF(observation.source_metadata->>'marginOfErrorVariableId', '')
WHERE source_margin_of_error_field IS NULL
  AND observation.source_metadata ? 'marginOfErrorVariableId';

UPDATE evidence.metric_observation
SET source_estimate_field = source_variable_id
WHERE source_estimate_field IS NULL AND source_variable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS metric_observation_acs_provenance_idx
  ON evidence.metric_observation (source_version_id, source_variable_id)
  WHERE source_variable_id IS NOT NULL;

COMMIT;
