BEGIN;

-- Derived ACS percentages require both numerator and denominator uncertainty
-- inputs. These columns make the published calculation reproducible without
-- promoting legacy rows whose field provenance was never verified.
ALTER TABLE evidence.metric_observation
  ADD COLUMN IF NOT EXISTS source_numerator_margin_of_error_variable_id text,
  ADD COLUMN IF NOT EXISTS source_denominator_margin_of_error_variable_id text,
  ADD COLUMN IF NOT EXISTS source_margin_of_error_formula text;

UPDATE evidence.metric_observation observation
SET
  source_numerator_margin_of_error_variable_id = CASE
    WHEN observation.source_metadata->>'numeratorMarginOfErrorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[M]$'
      THEN observation.source_metadata->>'numeratorMarginOfErrorVariableId'
    ELSE observation.source_numerator_margin_of_error_variable_id
  END,
  source_denominator_margin_of_error_variable_id = CASE
    WHEN observation.source_metadata->>'denominatorMarginOfErrorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[M]$'
      THEN observation.source_metadata->>'denominatorMarginOfErrorVariableId'
    ELSE observation.source_denominator_margin_of_error_variable_id
  END,
  source_margin_of_error_formula = COALESCE(
    NULLIF(observation.source_margin_of_error_formula, ''),
    NULLIF(observation.source_metadata->>'marginOfErrorFormula', '')
  )
WHERE observation.source_metadata IS NOT NULL;

COMMIT;
