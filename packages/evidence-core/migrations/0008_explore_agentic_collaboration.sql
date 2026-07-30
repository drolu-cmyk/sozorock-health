BEGIN;

DO $$ BEGIN
  CREATE TYPE evidence.workspace_role AS ENUM (
    'foundation_reviewer',
    'county_planner',
    'community_partner',
    'research_funder_viewer',
    'evidence_agent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence.workspace_access AS ENUM ('owner', 'contributor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence.workspace_actor_type AS ENUM ('human', 'agent', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence.workspace_event_type AS ENUM (
    'workspace_created',
    'participant_joined',
    'evidence_loaded',
    'question_asked',
    'agent_tool_called',
    'agent_claim_validated',
    'result_added_to_plan',
    'scenario_created',
    'scenario_modified',
    'source_updated',
    'human_review_requested',
    'human_review_completed',
    'snapshot_exported',
    'workspace_archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS evidence.workspace_tenant (
  id uuid PRIMARY KEY,
  legal_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL,
  created_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence.county_workspace (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES evidence.workspace_tenant(id),
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  evidence_snapshot_id uuid NOT NULL REFERENCES evidence.evidence_snapshot(id),
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS county_workspace_tenant_geography_idx
  ON evidence.county_workspace (tenant_id, geography_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS county_workspace_one_active_per_place
  ON evidence.county_workspace (tenant_id, geography_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS evidence.workspace_participant (
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  principal_id text NOT NULL,
  role evidence.workspace_role NOT NULL,
  access evidence.workspace_access NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (workspace_id, principal_id)
);

CREATE TABLE IF NOT EXISTS evidence.workspace_invitation (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  role evidence.workspace_role NOT NULL,
  access evidence.workspace_access NOT NULL,
  invited_by text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_by text,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  CHECK (accepted_at IS NULL OR accepted_by IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS evidence.workspace_event (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  tenant_id uuid NOT NULL REFERENCES evidence.workspace_tenant(id),
  sequence_number bigint NOT NULL CHECK (sequence_number > 0),
  event_type evidence.workspace_event_type NOT NULL,
  actor_type evidence.workspace_actor_type NOT NULL,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  evidence_snapshot_id uuid REFERENCES evidence.evidence_snapshot(id),
  policy_version text NOT NULL,
  model_version text,
  prompt_version text,
  tool_name text,
  request_hash text CHECK (request_hash IS NULL OR request_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  response_hash text CHECK (response_hash IS NULL OR response_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'failed', 'recorded')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  UNIQUE (workspace_id, sequence_number),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS workspace_event_sequence_idx
  ON evidence.workspace_event (workspace_id, sequence_number);

CREATE TABLE IF NOT EXISTS evidence.workspace_section (
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  section_key text NOT NULL CHECK (section_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  version bigint NOT NULL CHECK (version > 0),
  content jsonb NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, section_key)
);

CREATE TABLE IF NOT EXISTS evidence.workspace_section_version (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  section_key text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  content jsonb NOT NULL,
  actor_type evidence.workspace_actor_type NOT NULL,
  actor_id text NOT NULL,
  source_event_id uuid NOT NULL REFERENCES evidence.workspace_event(id),
  created_at timestamptz NOT NULL,
  UNIQUE (workspace_id, section_key, version)
);

CREATE TABLE IF NOT EXISTS evidence.workspace_comment (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  section_key text NOT NULL,
  actor_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  evidence_attachment_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  resolved_by text
);

CREATE TABLE IF NOT EXISTS evidence.workspace_review_question (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  section_key text NOT NULL,
  question text NOT NULL,
  assigned_to text,
  status text NOT NULL CHECK (status IN ('open', 'answered', 'closed')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS evidence.agent_suggestion (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  section_key text NOT NULL,
  execution_audit_id uuid REFERENCES evidence.execution_audit(id),
  content jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  CHECK (status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS evidence.workspace_presence (
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  connection_id text NOT NULL,
  principal_id text NOT NULL,
  display_name text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, connection_id)
);

CREATE INDEX IF NOT EXISTS workspace_presence_expiry_idx
  ON evidence.workspace_presence (expires_at);

CREATE TABLE IF NOT EXISTS evidence.planning_scenario (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'local_review', 'accepted', 'archived')),
  current_version integer NOT NULL CHECK (current_version > 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence.planning_scenario_version (
  id uuid PRIMARY KEY,
  scenario_id uuid NOT NULL REFERENCES evidence.planning_scenario(id),
  version integer NOT NULL CHECK (version > 0),
  model_version text NOT NULL,
  inputs jsonb NOT NULL,
  formulae jsonb NOT NULL,
  evidence_used jsonb NOT NULL,
  evidence_missing jsonb NOT NULL,
  outputs jsonb NOT NULL,
  assumption_owner text NOT NULL,
  human_review_status text NOT NULL CHECK (
    human_review_status IN ('not_reviewed', 'review_requested', 'verified', 'rejected')
  ),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (scenario_id, version)
);

CREATE TABLE IF NOT EXISTS evidence.funder_snapshot (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  evidence_snapshot_id uuid NOT NULL REFERENCES evidence.evidence_snapshot(id),
  scenario_version_id uuid REFERENCES evidence.planning_scenario_version(id),
  contract_version text NOT NULL,
  review_status text NOT NULL CHECK (
    review_status IN ('not_reviewed', 'review_requested', 'verified', 'rejected')
  ),
  payload jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence.source_adapter_contract (
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  contract_version text NOT NULL,
  official_host_allowlist text[] NOT NULL,
  schema_fingerprint text NOT NULL CHECK (schema_fingerprint ~ '^sha256:[0-9a-fA-F]{64}$'),
  release_discovery jsonb NOT NULL,
  retrieval_schedule text NOT NULL,
  freshness_policy jsonb NOT NULL,
  measure_mapping_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'paused', 'withdrawn', 'review_required')),
  last_approved_snapshot_id uuid REFERENCES evidence.evidence_snapshot(id),
  rollback_snapshot_id uuid REFERENCES evidence.evidence_snapshot(id),
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL,
  PRIMARY KEY (source_id, contract_version)
);

CREATE TABLE IF NOT EXISTS evidence.source_adapter_execution (
  id uuid PRIMARY KEY,
  source_id text NOT NULL,
  contract_version text NOT NULL,
  candidate_release text,
  candidate_checksum text CHECK (
    candidate_checksum IS NULL OR candidate_checksum ~ '^sha256:[0-9a-fA-F]{64}$'
  ),
  schema_fingerprint text CHECK (
    schema_fingerprint IS NULL OR schema_fingerprint ~ '^sha256:[0-9a-fA-F]{64}$'
  ),
  status text NOT NULL CHECK (
    status IN (
      'discovered', 'validated', 'schema_drift', 'coverage_regression',
      'retrieval_failed', 'withdrawn', 'awaiting_review', 'approved', 'rejected'
    )
  ),
  attempt integer NOT NULL CHECK (attempt > 0),
  record_count bigint CHECK (record_count IS NULL OR record_count >= 0),
  failure_detail text,
  proposal_url text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY (source_id, contract_version)
    REFERENCES evidence.source_adapter_contract(source_id, contract_version)
);

INSERT INTO evidence.capability_switch (capability_key, enabled, reason, updated_at, updated_by)
VALUES
  ('explore:collaboration', false, 'Requires staging authorization, real-time and tenant-isolation gates.', now(), 'migration:0008'),
  ('explore:scenarios', false, 'Requires scenario contract and human-review acceptance gates.', now(), 'migration:0008'),
  ('explore:funder_snapshots', false, 'Requires reviewed export contract and disclosure gates.', now(), 'migration:0008'),
  ('explore:source_maintenance', false, 'Candidate releases require schema and human-review gates.', now(), 'migration:0008')
ON CONFLICT (capability_key) DO NOTHING;

DROP TRIGGER IF EXISTS workspace_event_append_only ON evidence.workspace_event;
CREATE TRIGGER workspace_event_append_only
BEFORE UPDATE OR DELETE ON evidence.workspace_event
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS workspace_section_version_append_only ON evidence.workspace_section_version;
CREATE TRIGGER workspace_section_version_append_only
BEFORE UPDATE OR DELETE ON evidence.workspace_section_version
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS planning_scenario_version_append_only ON evidence.planning_scenario_version;
CREATE TRIGGER planning_scenario_version_append_only
BEFORE UPDATE OR DELETE ON evidence.planning_scenario_version
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS funder_snapshot_append_only ON evidence.funder_snapshot;
CREATE TRIGGER funder_snapshot_append_only
BEFORE UPDATE OR DELETE ON evidence.funder_snapshot
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS source_adapter_execution_append_only ON evidence.source_adapter_execution;
CREATE TRIGGER source_adapter_execution_append_only
BEFORE UPDATE OR DELETE ON evidence.source_adapter_execution
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

COMMIT;
