BEGIN;

DROP TRIGGER IF EXISTS source_adapter_execution_append_only ON evidence.source_adapter_execution;
DROP TRIGGER IF EXISTS funder_snapshot_append_only ON evidence.funder_snapshot;
DROP TRIGGER IF EXISTS planning_scenario_version_append_only ON evidence.planning_scenario_version;
DROP TRIGGER IF EXISTS workspace_section_version_append_only ON evidence.workspace_section_version;
DROP TRIGGER IF EXISTS workspace_event_append_only ON evidence.workspace_event;

DROP TABLE IF EXISTS evidence.source_adapter_execution;
DROP TABLE IF EXISTS evidence.source_adapter_contract;
DROP TABLE IF EXISTS evidence.funder_snapshot;
DROP TABLE IF EXISTS evidence.planning_scenario_version;
DROP TABLE IF EXISTS evidence.planning_scenario;
DROP TABLE IF EXISTS evidence.workspace_presence;
DROP TABLE IF EXISTS evidence.agent_suggestion;
DROP TABLE IF EXISTS evidence.workspace_review_question;
DROP TABLE IF EXISTS evidence.workspace_comment;
DROP TABLE IF EXISTS evidence.workspace_section_version;
DROP TABLE IF EXISTS evidence.workspace_section;
DROP TABLE IF EXISTS evidence.workspace_event;
DROP TABLE IF EXISTS evidence.workspace_invitation;
DROP TABLE IF EXISTS evidence.workspace_participant;
DROP TABLE IF EXISTS evidence.county_workspace;
DROP TABLE IF EXISTS evidence.workspace_tenant;

DROP TYPE IF EXISTS evidence.workspace_event_type;
DROP TYPE IF EXISTS evidence.workspace_actor_type;
DROP TYPE IF EXISTS evidence.workspace_access;
DROP TYPE IF EXISTS evidence.workspace_role;

DELETE FROM evidence.capability_switch
WHERE capability_key IN (
  'explore:collaboration',
  'explore:scenarios',
  'explore:funder_snapshots',
  'explore:source_maintenance'
);

COMMIT;
