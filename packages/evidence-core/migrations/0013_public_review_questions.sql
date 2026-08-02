BEGIN;

-- Public bearer shares may expose only questions that a reviewer has
-- explicitly marked public and that are answered or closed.  The default is
-- private so existing questions cannot become public by accident.
ALTER TABLE evidence.workspace_review_question
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS workspace_review_question_public_idx
  ON evidence.workspace_review_question (workspace_id, status, created_at)
  WHERE is_public = true;

COMMIT;
