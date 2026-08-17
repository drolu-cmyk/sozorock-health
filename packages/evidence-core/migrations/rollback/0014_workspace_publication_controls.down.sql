BEGIN;

DROP INDEX IF EXISTS evidence.workspace_section_publication_idx;
ALTER TABLE evidence.workspace_section
  DROP CONSTRAINT IF EXISTS workspace_section_publication_status_check,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS published_by,
  DROP COLUMN IF EXISTS publication_status;
DELETE FROM evidence.capability_switch WHERE capability_key='explore:public-sharing';

COMMIT;
