BEGIN;

-- New invitations/handoffs can be bound to one authenticated principal. NULL
-- is retained for legacy links and is treated as an unbound, expiring invite;
-- it is never used to bypass tenant, role, expiry or revocation checks.
ALTER TABLE evidence.workspace_invitation
  ADD COLUMN IF NOT EXISTS intended_principal_id text;

ALTER TABLE evidence.workspace_handoff
  ADD COLUMN IF NOT EXISTS target_principal_id text;

CREATE INDEX IF NOT EXISTS workspace_invitation_recipient_idx
  ON evidence.workspace_invitation (workspace_id, intended_principal_id)
  WHERE intended_principal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_handoff_recipient_idx
  ON evidence.workspace_handoff (workspace_id, target_principal_id)
  WHERE target_principal_id IS NOT NULL;

COMMIT;
