BEGIN;

DROP TRIGGER IF EXISTS source_change_proposal_append_only ON evidence.source_change_proposal;
DROP TRIGGER IF EXISTS explore_performance_sample_append_only ON evidence.explore_performance_sample;
DROP TRIGGER IF EXISTS explore_usage_event_append_only ON evidence.explore_usage_event;
DROP TABLE IF EXISTS evidence.source_change_proposal;
DROP TABLE IF EXISTS evidence.explore_performance_sample;
DROP TABLE IF EXISTS evidence.explore_usage_event;
DROP TABLE IF EXISTS evidence.explore_onboarding_request;
DROP TABLE IF EXISTS evidence.workspace_handoff;
DROP TABLE IF EXISTS evidence.workspace_share_link;
DROP TABLE IF EXISTS evidence.entity_ip_readiness_check;

ALTER TABLE evidence.county_workspace
  DROP CONSTRAINT IF EXISTS county_workspace_share_mode_check,
  DROP COLUMN IF EXISTS parent_workspace_id,
  DROP COLUMN IF EXISTS forked_from_version,
  DROP COLUMN IF EXISTS share_mode,
  DROP COLUMN IF EXISTS last_handoff_at;

DELETE FROM evidence.capability_switch
WHERE capability_key IN (
  'explore:workspace-sharing', 'explore:workspace-forking',
  'explore:workspace-handoffs', 'explore:pilot-onboarding',
  'explore:usage-instrumentation', 'explore:source-maintenance-proposals'
);

COMMIT;
