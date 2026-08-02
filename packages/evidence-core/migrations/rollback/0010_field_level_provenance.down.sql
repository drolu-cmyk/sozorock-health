BEGIN;
ALTER TABLE evidence.metric_observation
  DROP COLUMN IF EXISTS source_variable_id,
  DROP COLUMN IF EXISTS source_numerator_variable_id,
  DROP COLUMN IF EXISTS source_denominator_variable_id,
  DROP COLUMN IF EXISTS source_formula,
  DROP COLUMN IF EXISTS source_transformation_version,
  DROP COLUMN IF EXISTS source_table,
  DROP COLUMN IF EXISTS source_group,
  DROP COLUMN IF EXISTS source_estimate_field,
  DROP COLUMN IF EXISTS source_margin_of_error_field;
COMMIT;
