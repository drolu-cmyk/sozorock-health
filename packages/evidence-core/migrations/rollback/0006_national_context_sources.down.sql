BEGIN;

DELETE FROM evidence.capability_switch
WHERE capability_key = 'source:ahrf';

UPDATE evidence.capability_switch
SET enabled = false,
    reason = 'Disabled by rollback of migration 0006.',
    updated_at = now(),
    updated_by = 'rollback:0006'
WHERE capability_key IN ('source:acs', 'source:ahrq_clh');

COMMIT;
