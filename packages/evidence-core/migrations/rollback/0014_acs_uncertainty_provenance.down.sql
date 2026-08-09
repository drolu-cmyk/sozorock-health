BEGIN;

ALTER TABLE evidence.metric_observation
  DROP COLUMN IF EXISTS source_margin_of_error_formula,
  DROP COLUMN IF EXISTS source_denominator_margin_of_error_variable_id,
  DROP COLUMN IF EXISTS source_numerator_margin_of_error_variable_id;

COMMIT;
