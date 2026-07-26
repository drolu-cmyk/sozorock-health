BEGIN;

DROP TRIGGER IF EXISTS evidence_snapshot_append_only ON evidence.evidence_snapshot;
DROP TRIGGER IF EXISTS execution_audit_append_only ON evidence.execution_audit;
DROP TRIGGER IF EXISTS import_manifest_append_only ON evidence.import_manifest;
DROP TRIGGER IF EXISTS schema_migration_append_only ON evidence.schema_migration;
DROP TABLE IF EXISTS evidence.capability_switch;
DROP TABLE IF EXISTS evidence.execution_audit;
DROP TABLE IF EXISTS evidence.source_health_event;
DROP TABLE IF EXISTS evidence.import_manifest;
DROP TABLE IF EXISTS evidence.source_coverage;
DROP TABLE IF EXISTS evidence.schema_migration;
DROP FUNCTION IF EXISTS evidence.prevent_immutable_record_mutation();

ALTER TABLE evidence.geography
  DROP COLUMN IF EXISTS water_area_square_meters,
  DROP COLUMN IF EXISTS land_area_square_meters,
  DROP COLUMN IF EXISTS geometry_status,
  DROP COLUMN IF EXISTS geometry_source_url,
  DROP COLUMN IF EXISTS release_scope,
  DROP COLUMN IF EXISTS geography_type_label,
  DROP COLUMN IF EXISTS legal_statistical_area_code;

DROP TYPE IF EXISTS evidence.source_coverage_status;

COMMIT;
