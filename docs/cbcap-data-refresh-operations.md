# CB-CAP public-data refresh operations

CB-CAP stores reviewed public-data snapshots so the public platform does not depend on an upstream service for its core county map and profiles. Refresh automation proposes changes for human review; it never merges or deploys them.

## Cadence and sources

The workflow runs on the first day of each month and can be started manually. It refreshes the currently approved Census geography and CDC PLACES inputs defined in the repository scripts. A monthly check is intentionally more frequent than the expected source-release cadence so release changes are detected without assuming that upstream schedules will remain fixed.

## Automated gates

The workflow:

1. starts from the protected `main` branch and installs the locked dependency graph;
2. rebuilds county profiles, runtime map data, and county/state boundaries;
3. verifies exactly 3,144 unique county equivalents and 51 state/DC records;
4. verifies source and boundary hashes, compatible schemas, HTTPS source URLs, and reviewed indicator-coverage thresholds;
5. permits changes only to the six generated CB-CAP data artifacts;
6. runs platform typecheck, lint, tests, production build, dependency audit, and a final data validation;
7. discards timestamp-only changes; and
8. opens or updates a pull request only when source data or source metadata changed.

The automation branch is `automation/cbcap-public-data-refresh`. Updating that branch does not approve, merge, or release its contents.

## Human review

Before approving a refresh pull request, confirm:

- source release notes, vintage, definitions, and methodology;
- county and state coverage, missing values, and unexpected distribution changes;
- confidence intervals or other uncertainty language where applicable;
- continued accuracy of modeled-estimate, non-clinical, and planning-scenario boundaries;
- map, search, profile, comparison, report, and accessible-table behavior; and
- the production release record references the approved commit.

If a source changes its schema, reduces reviewed coverage, or changes the county universe, the workflow must fail. Update the ingestion and validation logic in a separate reviewed change; do not weaken a gate merely to make a refresh pass.

## Manual verification

From a clean checkout with Node.js 24 and the locked dependencies installed:

```bash
npm run refresh:cbcap-data
npm run refresh:cbcap-geometries
node scripts/validate-cbcap-refresh.mjs
npm run typecheck --workspace @sozorock/platform
npm exec eslint -- apps/platform --max-warnings=0
npm run test --workspace @sozorock/platform
npm run build:platform
npm audit --omit=dev --audit-level=moderate
```

Review the generated diff before committing it. A refresh pull request and a production release remain two separate, human-approved actions.

If a managed workstation uses an enterprise certificate chain, run Node with `NODE_OPTIONS=--use-system-ca`. Never bypass TLS verification to make a refresh succeed.
