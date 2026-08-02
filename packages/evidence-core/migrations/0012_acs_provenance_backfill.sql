BEGIN;

-- Correct only metadata that is explicitly present and syntactically an
-- official ACS field. Internal adapter keys (for example `population` or
-- `POVERTY_PCT`) must never be published as source fields.
UPDATE evidence.metric_observation observation
SET source_variable_id = NULL
WHERE source_variable_id IS NOT NULL
  AND source_variable_id !~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$';

UPDATE evidence.metric_observation observation
SET
  source_numerator_variable_id = CASE
    WHEN observation.source_metadata->>'numeratorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
      THEN observation.source_metadata->>'numeratorVariableId'
    ELSE observation.source_numerator_variable_id
  END,
  source_denominator_variable_id = CASE
    WHEN observation.source_metadata->>'denominatorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
      THEN observation.source_metadata->>'denominatorVariableId'
    ELSE observation.source_denominator_variable_id
  END,
  source_formula = COALESCE(
    NULLIF(observation.source_formula, ''),
    NULLIF(observation.source_metadata->>'formula', '')
  ),
  source_transformation_version = COALESCE(
    NULLIF(observation.source_transformation_version, ''),
    NULLIF(observation.source_metadata->>'transformationVersion', '')
  ),
  source_table = COALESCE(
    NULLIF(observation.source_table, ''),
    NULLIF(observation.source_metadata->>'table', ''),
    CASE
      WHEN observation.source_metadata->>'numeratorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN split_part(observation.source_metadata->>'numeratorVariableId', '_', 1)
      WHEN observation.source_variable_id ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN split_part(observation.source_variable_id, '_', 1)
      ELSE NULL
    END
  ),
  source_group = COALESCE(
    NULLIF(observation.source_group, ''),
    NULLIF(observation.source_metadata->>'group', ''),
    CASE
      WHEN observation.source_metadata->>'numeratorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN split_part(observation.source_metadata->>'numeratorVariableId', '_', 1)
      WHEN observation.source_variable_id ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN split_part(observation.source_variable_id, '_', 1)
      ELSE NULL
    END
  ),
  source_estimate_field = COALESCE(
    NULLIF(observation.source_estimate_field, ''),
    CASE
      WHEN observation.source_metadata->>'numeratorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN observation.source_metadata->>'numeratorVariableId'
      WHEN observation.source_variable_id ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN observation.source_variable_id
      ELSE NULL
    END
  ),
  source_margin_of_error_field = COALESCE(
    NULLIF(observation.source_margin_of_error_field, ''),
    CASE
      WHEN observation.source_metadata->>'marginOfErrorVariableId' ~ '^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$'
        THEN observation.source_metadata->>'marginOfErrorVariableId'
      ELSE NULL
    END
  )
WHERE observation.source_metadata IS NOT NULL;

COMMIT;
