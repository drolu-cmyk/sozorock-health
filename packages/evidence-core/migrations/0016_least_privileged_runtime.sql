BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evidence_runtime') THEN
    CREATE ROLE evidence_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.configure_runtime_login(runtime_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, evidence
AS $$
BEGIN
  IF length(runtime_password) < 32 THEN
    RAISE EXCEPTION 'Runtime database password does not meet the minimum length.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evidence_runtime_login') THEN
    EXECUTE format(
      'ALTER ROLE evidence_runtime_login PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS',
      runtime_password
    );
  ELSE
    EXECUTE format(
      'CREATE ROLE evidence_runtime_login LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS',
      runtime_password
    );
  END IF;
  EXECUTE 'GRANT evidence_runtime TO evidence_runtime_login';
END;
$$;

REVOKE ALL ON FUNCTION evidence.configure_runtime_login(text) FROM PUBLIC;
REVOKE ALL ON SCHEMA evidence FROM PUBLIC;
GRANT USAGE ON SCHEMA evidence TO evidence_runtime;
GRANT SELECT ON TABLE
  evidence.agent_suggestion,
  evidence.capability_switch,
  evidence.county_workspace,
  evidence.evidence_citation,
  evidence.evidence_claim,
  evidence.evidence_claim_geography,
  evidence.evidence_snapshot,
  evidence.execution_audit,
  evidence.explore_onboarding_request,
  evidence.explore_performance_sample,
  evidence.explore_usage_event,
  evidence.geography,
  evidence.measure_definition,
  evidence.metric_observation,
  evidence.planning_document,
  evidence.planning_document_geography,
  evidence.planning_scenario,
  evidence.planning_scenario_version,
  evidence.schema_migration,
  evidence.snapshot_source_version,
  evidence.source_catalog,
  evidence.source_coverage,
  evidence.source_version,
  evidence.workforce_designation,
  evidence.workspace_comment,
  evidence.workspace_event,
  evidence.workspace_handoff,
  evidence.workspace_invitation,
  evidence.workspace_participant,
  evidence.workspace_review_question,
  evidence.workspace_section,
  evidence.workspace_section_version,
  evidence.workspace_share_link,
  evidence.workspace_tenant
TO evidence_runtime;
GRANT INSERT, UPDATE ON TABLE
  evidence.capability_switch,
  evidence.county_workspace,
  evidence.execution_audit,
  evidence.explore_onboarding_request,
  evidence.explore_performance_sample,
  evidence.explore_usage_event,
  evidence.planning_scenario,
  evidence.planning_scenario_version,
  evidence.workspace_event,
  evidence.workspace_handoff,
  evidence.workspace_invitation,
  evidence.workspace_participant,
  evidence.workspace_section,
  evidence.workspace_section_version,
  evidence.workspace_share_link
TO evidence_runtime;

COMMIT;
