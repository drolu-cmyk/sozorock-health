export const PUBLIC_DATA_REFRESH_SCHEDULES = [
  {
    adapterId: "cdc-places-v2",
    sourceId: "cdc-places",
    scheduleExpression: "cron(17 7 ? * MON *)",
    policy: "Check weekly; import only when the official dataset metadata or content hash changes.",
    staleAfterDays: 400,
  },
  {
    adapterId: "census-acs5-v2",
    sourceId: "census-acs5",
    scheduleExpression: "cron(37 7 1 * ? *)",
    policy: "Check monthly; import a new annual ACS vintage only after variable-contract validation.",
    staleAfterDays: 430,
  },
  {
    adapterId: "hrsa-hpsa-v2",
    sourceId: "hrsa-workforce",
    scheduleExpression: "cron(13 8 * * ? *)",
    policy: "Refresh daily; preserve designation type and current status from the source artifact.",
    staleAfterDays: 3,
  },
  {
    adapterId: "ahrq-clh-v2",
    sourceId: "ahrq-clh",
    scheduleExpression: "cron(53 8 1 * ? *)",
    policy: "Check monthly; require an approved codebook and parser for each new CLH release.",
    staleAfterDays: 430,
  },
] as const;
