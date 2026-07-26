BEGIN;

CREATE TABLE IF NOT EXISTS evidence.planning_document_candidate (
  id uuid PRIMARY KEY,
  source_family text NOT NULL CHECK (source_family IN (
    'state_clearinghouse',
    'county_local_health_department',
    'regional_planning_collaborative',
    'hospital_chna_csp_page'
  )),
  publisher text NOT NULL,
  approved_hosts text[] NOT NULL CHECK (cardinality(approved_hosts) > 0),
  source_page_url text NOT NULL CHECK (source_page_url ~ '^https://'),
  artifact_url text NOT NULL CHECK (artifact_url ~ '^https://'),
  document_type text NOT NULL CHECK (document_type IN (
    'cha', 'chip', 'chna', 'csp', 'implementation_strategy', 'supporting_report'
  )),
  title text NOT NULL,
  coverage_scope text NOT NULL CHECK (coverage_scope IN (
    'county_specific', 'regional', 'hospital_specific', 'state_level'
  )),
  publication_date date,
  publication_date_precision text NOT NULL CHECK (publication_date_precision IN (
    'day', 'month', 'year', 'unknown'
  )),
  plan_cycle_start date,
  plan_cycle_end date,
  retrieved_at timestamptz NOT NULL,
  candidate_confidence text NOT NULL CHECK (candidate_confidence IN ('high', 'moderate', 'low')),
  candidate_confidence_score numeric(4,3) NOT NULL CHECK (candidate_confidence_score BETWEEN 0 AND 1),
  confidence_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status evidence.review_status NOT NULL DEFAULT 'provisional',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artifact_url),
  CHECK (plan_cycle_start IS NULL OR plan_cycle_end IS NULL OR plan_cycle_start <= plan_cycle_end),
  CHECK (candidate_confidence <> 'high' OR candidate_confidence_score >= 0.8)
);

CREATE TABLE IF NOT EXISTS evidence.planning_candidate_geography (
  candidate_id uuid NOT NULL REFERENCES evidence.planning_document_candidate(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES evidence.geography(id),
  relationship_kind text NOT NULL CHECK (relationship_kind IN ('applies_to', 'includes', 'references')),
  review_status evidence.review_status NOT NULL DEFAULT 'provisional',
  PRIMARY KEY (candidate_id, geography_id, relationship_kind)
);

ALTER TABLE evidence.planning_document
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES evidence.planning_document_candidate(id),
  ADD COLUMN IF NOT EXISTS coverage_scope text,
  ADD COLUMN IF NOT EXISTS current_plan_status text NOT NULL DEFAULT 'not_yet_verified';

ALTER TABLE evidence.planning_document
  DROP CONSTRAINT IF EXISTS planning_document_coverage_scope_check,
  ADD CONSTRAINT planning_document_coverage_scope_check CHECK (
    coverage_scope IS NULL OR coverage_scope IN ('county_specific', 'regional', 'hospital_specific', 'state_level')
  ),
  DROP CONSTRAINT IF EXISTS planning_document_current_plan_status_check,
  ADD CONSTRAINT planning_document_current_plan_status_check CHECK (
    current_plan_status IN ('verified_current', 'not_yet_verified', 'superseded', 'not_applicable')
  ),
  DROP CONSTRAINT IF EXISTS planning_document_verified_current_check,
  ADD CONSTRAINT planning_document_verified_current_check CHECK (
    current_plan_status <> 'verified_current'
    OR (
      coverage_scope = 'county_specific'
      AND document_type = 'chip'
      AND review_status = 'verified'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  );

ALTER TABLE evidence.evidence_claim
  DROP CONSTRAINT IF EXISTS evidence_claim_claim_type_check;

ALTER TABLE evidence.evidence_claim
  ADD CONSTRAINT evidence_claim_claim_type_check CHECK (claim_type IN (
    'priority',
    'finding',
    'disparity',
    'barrier',
    'objective',
    'intervention',
    'responsible_partner',
    'target_population',
    'evaluation_measure',
    'asset',
    'action',
    'data_gap'
  ));

ALTER TABLE evidence.evidence_citation
  ADD COLUMN IF NOT EXISTS artifact_page_index integer;

ALTER TABLE evidence.evidence_citation
  DROP CONSTRAINT IF EXISTS evidence_citation_artifact_page_index_check,
  ADD CONSTRAINT evidence_citation_artifact_page_index_check CHECK (
    artifact_page_index IS NULL OR artifact_page_index >= 0
  );

CREATE TABLE IF NOT EXISTS evidence.planning_review_task (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES evidence.planning_document_candidate(id) ON DELETE CASCADE,
  document_id uuid REFERENCES evidence.planning_document(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES evidence.evidence_claim(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'candidate_source_not_approved',
    'candidate_confidence_below_threshold',
    'document_scope_ambiguous',
    'covered_geography_ambiguous',
    'publication_date_missing',
    'plan_cycle_missing',
    'current_plan_not_verified',
    'citation_locator_missing',
    'citation_text_mismatch',
    'claim_not_explicit',
    'extraction_confidence_low',
    'formal_verification_required'
  )),
  status text NOT NULL CHECK (status IN ('open', 'in_review', 'approved', 'rejected')),
  severity text NOT NULL CHECK (severity IN ('blocking', 'review_required')),
  summary text NOT NULL,
  created_at timestamptz NOT NULL,
  assigned_to text,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  CHECK (
    status IN ('open', 'in_review')
    OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_note IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS planning_candidate_review_idx
  ON evidence.planning_document_candidate (review_status, candidate_confidence, retrieved_at DESC);
CREATE INDEX IF NOT EXISTS planning_review_open_idx
  ON evidence.planning_review_task (status, severity, created_at);

CREATE OR REPLACE FUNCTION evidence.prevent_unverified_current_county_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_plan_status = 'verified_current' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM evidence.source_version source
      WHERE source.id = NEW.source_version_id
        AND source.review_status = 'verified'
        AND source.reviewed_by IS NOT NULL
        AND source.reviewed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'A planning document without a verified source version cannot be designated as the current county plan';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM evidence.planning_review_task task
      WHERE task.document_id = NEW.id
        AND task.status IN ('open', 'in_review')
        AND task.severity = 'blocking'
    ) THEN
      RAISE EXCEPTION 'A planning document with an open blocking review task cannot be designated as the current county plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_document_current_plan_guard ON evidence.planning_document;
CREATE TRIGGER planning_document_current_plan_guard
BEFORE INSERT OR UPDATE OF current_plan_status, review_status ON evidence.planning_document
FOR EACH ROW EXECUTE FUNCTION evidence.prevent_unverified_current_county_plan();

COMMIT;
