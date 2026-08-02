BEGIN;
ALTER TABLE evidence.workspace_invitation
  DROP COLUMN IF EXISTS intended_principal_id;
ALTER TABLE evidence.workspace_handoff
  DROP COLUMN IF EXISTS target_principal_id;
COMMIT;
