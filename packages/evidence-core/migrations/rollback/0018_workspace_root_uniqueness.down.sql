BEGIN;

-- Restoring the older rule is unsafe once active forks exist. Fail closed;
-- never delete or archive user work as a side effect of rollback.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM evidence.county_workspace WHERE status = 'active'
    GROUP BY tenant_id, geography_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot restore the earlier workspace uniqueness rule while active forks coexist.';
  END IF;
END $$;
DROP INDEX IF EXISTS evidence.county_workspace_one_active_per_place;
CREATE UNIQUE INDEX county_workspace_one_active_per_place
  ON evidence.county_workspace (tenant_id, geography_id)
  WHERE status = 'active';
DROP INDEX IF EXISTS evidence.county_workspace_active_fork_idx;

COMMIT;
