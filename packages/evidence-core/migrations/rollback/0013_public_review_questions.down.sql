BEGIN;

DROP INDEX IF EXISTS evidence.workspace_review_question_public_idx;
ALTER TABLE evidence.workspace_review_question
  DROP COLUMN IF EXISTS is_public;

COMMIT;
