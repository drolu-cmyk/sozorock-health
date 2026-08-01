BEGIN;

-- Advanced Explore collaboration, pilot onboarding and privacy-safe
-- operational measurement.  These records are intentionally separate from
-- resident/contact data and are never used as clinical evidence.

ALTER TABLE evidence.county_workspace
  ADD COLUMN IF NOT EXISTS parent_workspace_id uuid REFERENCES evidence.county_workspace(id),
  ADD COLUMN IF NOT EXISTS forked_from_version bigint,
  ADD COLUMN IF NOT EXISTS share_mode text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS last_handoff_at timestamptz;

DO $$ BEGIN
  ALTER TYPE evidence.workspace_event_type ADD VALUE IF NOT EXISTS 'workspace_shared';
  ALTER TYPE evidence.workspace_event_type ADD VALUE IF NOT EXISTS 'workspace_forked';
  ALTER TYPE evidence.workspace_event_type ADD VALUE IF NOT EXISTS 'workspace_handoff_created';
  ALTER TYPE evidence.workspace_event_type ADD VALUE IF NOT EXISTS 'workspace_handoff_accepted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE evidence.county_workspace
  DROP CONSTRAINT IF EXISTS county_workspace_share_mode_check,
  ADD CONSTRAINT county_workspace_share_mode_check CHECK (share_mode IN ('private', 'shared', 'handoff_ready'));

CREATE INDEX IF NOT EXISTS county_workspace_parent_idx
  ON evidence.county_workspace (parent_workspace_id, created_at);

CREATE TABLE IF NOT EXISTS evidence.workspace_share_link (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  tenant_id uuid NOT NULL REFERENCES evidence.workspace_tenant(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  scope text NOT NULL CHECK (scope IN ('read_only', 'contributor')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_access_at timestamptz
);

CREATE INDEX IF NOT EXISTS workspace_share_link_active_idx
  ON evidence.workspace_share_link (workspace_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS evidence.workspace_handoff (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES evidence.county_workspace(id),
  tenant_id uuid NOT NULL REFERENCES evidence.workspace_tenant(id),
  source_principal_id text NOT NULL,
  target_role text NOT NULL CHECK (target_role IN ('county_planner', 'community_partner', 'research_funder_viewer', 'foundation_reviewer')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  accepted_by text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (accepted_at IS NULL OR accepted_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS workspace_handoff_pending_idx
  ON evidence.workspace_handoff (workspace_id, status, expires_at);

CREATE TABLE IF NOT EXISTS evidence.explore_onboarding_request (
  id uuid PRIMARY KEY,
  county_geoid text NOT NULL CHECK (county_geoid ~ '^\d{5}$'),
  organization text NOT NULL CHECK (char_length(organization) BETWEEN 2 AND 180),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254),
  role text NOT NULL CHECK (role IN ('county', 'provider', 'library', 'community_host', 'education_workforce', 'funder', 'research')),
  intended_use text NOT NULL CHECK (char_length(intended_use) BETWEEN 10 AND 1000),
  consent boolean NOT NULL,
  source text NOT NULL CHECK (source IN ('explore', 'funder_snapshot', 'partner_referral', 'direct')),
  environment text NOT NULL CHECK (environment IN ('test', 'staging', 'production')),
  status text NOT NULL CHECK (status IN ('ready_for_review', 'rejected', 'contacted', 'enrolled', 'closed')),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^sha256:[0-9a-fA-F]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL,
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE INDEX IF NOT EXISTS explore_onboarding_county_status_idx
  ON evidence.explore_onboarding_request (county_geoid, status, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence.explore_usage_event (
  id uuid PRIMARY KEY,
  event_name text NOT NULL,
  geography_id uuid REFERENCES evidence.geography(id),
  workspace_id uuid REFERENCES evidence.county_workspace(id),
  session_id_hash text CHECK (session_id_hash IS NULL OR session_id_hash ~ '^sha256:[0-9a-fA-F]{64}$'),
  environment text NOT NULL CHECK (environment IN ('test', 'staging', 'production')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  retention_until timestamptz NOT NULL,
  counts_as_traction boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS explore_usage_event_time_idx
  ON evidence.explore_usage_event (environment, event_name, occurred_at DESC);

CREATE TABLE IF NOT EXISTS evidence.explore_performance_sample (
  id uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('place_brief', 'agent_response', 'map_geometry', 'workspace_event', 'source_refresh')),
  environment text NOT NULL CHECK (environment IN ('test', 'staging', 'production')),
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  success boolean NOT NULL,
  error_class text,
  estimated_cost_micros bigint CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  correction_required boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS explore_performance_operation_idx
  ON evidence.explore_performance_sample (environment, operation, occurred_at DESC);

CREATE TABLE IF NOT EXISTS evidence.source_change_proposal (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence.source_catalog(id),
  contract_version text NOT NULL,
  previous_snapshot_id uuid REFERENCES evidence.evidence_snapshot(id),
  candidate_release text,
  candidate_checksum text CHECK (candidate_checksum IS NULL OR candidate_checksum ~ '^sha256:[0-9a-fA-F]{64}$'),
  change_type text NOT NULL CHECK (change_type IN ('new_release', 'schema_drift', 'coverage_regression', 'meaning_change', 'source_withdrawn')),
  status text NOT NULL CHECK (status IN ('review_required', 'blocked', 'approved', 'rejected')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  pull_request_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE INDEX IF NOT EXISTS source_change_proposal_status_idx
  ON evidence.source_change_proposal (source_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence.entity_ip_readiness_check (
  id uuid PRIMARY KEY,
  area text NOT NULL CHECK (area IN ('entity', 'trademark', 'copyright', 'data_license', 'privacy', 'contract')),
  status text NOT NULL CHECK (status IN ('not_started', 'in_review', 'ready', 'blocked')),
  owner text NOT NULL,
  evidence_url text,
  due_date date,
  notes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS explore_usage_event_append_only ON evidence.explore_usage_event;
CREATE TRIGGER explore_usage_event_append_only
BEFORE UPDATE OR DELETE ON evidence.explore_usage_event
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS explore_performance_sample_append_only ON evidence.explore_performance_sample;
CREATE TRIGGER explore_performance_sample_append_only
BEFORE UPDATE OR DELETE ON evidence.explore_performance_sample
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

DROP TRIGGER IF EXISTS source_change_proposal_append_only ON evidence.source_change_proposal;
CREATE TRIGGER source_change_proposal_append_only
BEFORE UPDATE OR DELETE ON evidence.source_change_proposal
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_immutable_record_mutation();

INSERT INTO evidence.capability_switch (capability_key, enabled, reason, updated_at, updated_by)
VALUES
  ('explore:workspace-sharing', true, 'Scoped links remain read-only or contributor-limited and expire.', now(), 'migration:0009'),
  ('explore:workspace-forking', true, 'Forks retain source workspace and evidence snapshot lineage.', now(), 'migration:0009'),
  ('explore:workspace-handoffs', true, 'Handoffs are one-time, expiring and auditable.', now(), 'migration:0009'),
  ('explore:pilot-onboarding', true, 'Self-serve requests are bounded, consented and reviewable.', now(), 'migration:0009'),
  ('explore:usage-instrumentation', true, 'Only privacy-safe aggregate operations are recorded.', now(), 'migration:0009'),
  ('explore:source-maintenance-proposals', true, 'Upstream changes create guarded review proposals, never silent replacement.', now(), 'migration:0009')
ON CONFLICT (capability_key) DO UPDATE SET
  enabled=EXCLUDED.enabled,
  reason=EXCLUDED.reason,
  updated_at=EXCLUDED.updated_at,
  updated_by=EXCLUDED.updated_by;

COMMIT;
