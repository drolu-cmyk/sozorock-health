BEGIN;

-- Restoring the pre-fork uniqueness contract requires active forks to leave
-- the active set. Their immutable sections/events remain available for audit.
UPDATE evidence.county_workspace
SET status = 'archived', updated_at = now()
WHERE status = 'active' AND parent_workspace_id IS NOT NULL;

DROP INDEX IF EXISTS evidence.county_workspace_active_fork_idx;
DROP INDEX IF EXISTS evidence.county_workspace_one_active_per_place;

CREATE UNIQUE INDEX county_workspace_one_active_per_place
  ON evidence.county_workspace (tenant_id, geography_id)
  WHERE status = 'active';

COMMIT;
