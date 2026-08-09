BEGIN;

-- A tenant has one canonical active workspace per county, while explicitly
-- parented planning forks may coexist for comparison and review.
DROP INDEX IF EXISTS evidence.county_workspace_one_active_per_place;

CREATE UNIQUE INDEX county_workspace_one_active_per_place
  ON evidence.county_workspace (tenant_id, geography_id)
  WHERE status = 'active' AND parent_workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS county_workspace_active_fork_idx
  ON evidence.county_workspace (tenant_id, geography_id, parent_workspace_id)
  WHERE status = 'active' AND parent_workspace_id IS NOT NULL;

COMMIT;
