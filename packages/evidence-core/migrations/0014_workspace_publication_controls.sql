BEGIN;

ALTER TABLE evidence.workspace_section
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS published_by text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

DO $$ BEGIN
  ALTER TABLE evidence.workspace_section
    ADD CONSTRAINT workspace_section_publication_status_check
    CHECK (publication_status IN ('private', 'review', 'approved', 'revoked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS workspace_section_publication_idx
  ON evidence.workspace_section (workspace_id, publication_status)
  WHERE publication_status = 'approved';

INSERT INTO evidence.capability_switch (capability_key, enabled, reason, updated_at, updated_by)
VALUES (
  'explore:public-sharing',
  false,
  'Requires an independent reviewed-publication approval path.',
  now(),
  'migration:0014'
)
ON CONFLICT (capability_key) DO NOTHING;

COMMIT;
