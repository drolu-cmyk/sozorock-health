BEGIN;
DELETE FROM evidence.workspace_participant
WHERE principal_id='sozorock-place-agent' AND role='evidence_agent';
COMMIT;
