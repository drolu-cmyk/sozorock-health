BEGIN;

INSERT INTO evidence.capability_switch (capability_key, enabled, reason, updated_at, updated_by)
VALUES
  (
    'source:acs',
    true,
    'Approved 2020-2024 five-year Summary File snapshot reads are enabled; public requests do not call the upstream API.',
    now(),
    'migration:0006'
  ),
  (
    'source:ahrf',
    true,
    'Approved AHRF 2024-2025 snapshot reads are enabled with source-specific years retained.',
    now(),
    'migration:0006'
  ),
  (
    'source:ahrq_clh',
    true,
    'Approved September 2025 county workbook variables passed matching codebook, geography, checksum, and completeness validation.',
    now(),
    'migration:0006'
  )
ON CONFLICT (capability_key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    reason = EXCLUDED.reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

COMMIT;
