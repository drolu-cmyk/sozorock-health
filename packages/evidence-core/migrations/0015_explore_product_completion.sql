BEGIN;

INSERT INTO evidence.workspace_participant (
  workspace_id, principal_id, role, access, display_name, joined_at
)
SELECT w.id, 'sozorock-place-agent', 'evidence_agent', 'contributor',
  'SozoRock Place Intelligence', now()
FROM evidence.county_workspace w
ON CONFLICT (workspace_id, principal_id) DO NOTHING;

COMMIT;
