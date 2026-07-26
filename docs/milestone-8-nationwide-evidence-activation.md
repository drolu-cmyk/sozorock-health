# Milestone 8 nationwide evidence activation

Status date: July 23, 2026. Scope: the 50 states and District of Columbia. No production migration, deployment, or public release is authorized by this milestone.

## Resolved baseline

- Production source: `origin/main` at `fb67219e8b347dd58944407f5af818c0300d956b`.
- Last successful production deployment source: the same `fb67219e8b347dd58944407f5af818c0300d956b` commit.
- Milestones 1 through 7 form one continuous chain ending at `3e6096c9c6c9194c5886bff6897bef50f1abff8c`.
- Integration branch: `codex/milestone-8-nationwide-evidence-activation`.
- The production workflow is manual and checks out `main`; the Milestone 8 workflow is non-deploying and branch-scoped.

## Canonical geography

The national catalog is rebuilt from official Census 2025 Gazetteer files for states, counties and county equivalents, Census places, and ZCTAs. The selected official vintage derives 3,144 counties and county equivalents in the 50-state-plus-DC release scope; the value is not hard-coded.

The catalog retains:

- official name, GEOID, Census class, and county-equivalent type;
- state-to-county and ZCTA-to-county relationships;
- centroid and area metadata from the Gazetteer source;
- the 2020 Census vintage on the official ZCTA-to-county relationship file;
- postal ZIP input as a separate concept from Census ZCTA evidence;
- all cross-county ZCTA overlaps rather than choosing one county;
- Puerto Rico as extended inventory coverage and the island areas as separately inventoried jurisdictions.

Generated validation artifacts are in `packages/evidence-core/data/national`. The build reports zero duplicate county GEOIDs, zero invalid county GEOIDs, zero orphan counties, and zero missing county geometry metadata.

## Evidence storage and contract

PostgreSQL with PostGIS is the canonical persistent store. Migration `0004_nationwide_evidence_activation.sql` extends the committed schema without modifying migrations 0001 through 0003. It adds:

- immutable import manifests and source-version checksums;
- source coverage and source-health history;
- immutable evidence snapshots;
- immutable execution audit records;
- source and narrative capability switches;
- migration hash records;
- geography type, release-scope, and geometry metadata.

Source artifacts remain versioned in S3 in the approved AWS design. Database credentials belong in AWS Secrets Manager and are read only through `EVIDENCE_DATABASE_URL`; credentials are never written into evidence rows, cache metadata, manifests, or the repository.

The public contract is `ExplorePlaceBriefV1`. Every county response contains canonical geography, compatible observations, separate source coverage, dates, missing evidence, planning-document status, limitations, citations, and response-fit status. A missing source never removes the county and never becomes zero.

## Refresh, cache, and audit behavior

1. A scheduled adapter downloads an official release into an immutable source artifact.
2. The import manifest records the public source URL, release, retrieval time, byte count, SHA-256 checksum, and execution ID.
3. Idempotency keys prevent re-importing the same source release and geography.
4. A successful reviewed import produces a versioned evidence snapshot; it does not overwrite an earlier snapshot.
5. Public evidence is read only from the last approved snapshot. Refresh failure leaves that snapshot active and records source health separately.
6. Public cache identity includes contract version, evidence snapshot, policy version, capability-switch state, and geography.
7. Source capability switches can disable Census, CDC, ACS, HRSA, AHRQ, local-plan evidence, or narrative generation independently.
8. Import, publication, agent, correction, and rollback events append immutable audit records.

Recommended refresh cadence:

| Source | Refresh trigger | Failure behavior |
|---|---|---|
| Census geography | New approved annual vintage | Keep the prior approved catalog active |
| CDC PLACES | New official release | Mark source health and retain the prior approved snapshot |
| ACS five-year | New official annual release | Mark credential or source state explicitly |
| HRSA shortage areas | Approved periodic snapshot | Preserve facility, population-group, subcounty, and whole-county distinctions |
| AHRQ Community-Level Health | New approved workbook and codebook | Do not combine database versions |
| Local plans | Monthly candidate discovery and human review | Never publish an unverified current-plan claim |

## Current source activation

| Source | Current staged status | Evidence rule |
|---|---|---|
| Census geography | Available for every county | Official 2025 Gazetteer; official 2020 ZCTA relationship caveat retained |
| CDC PLACES | Available or partially available for 3,143 counties; unavailable from source for one | December 2025 county snapshot; absent values remain absent |
| ACS 2020–2024 five-year | Credential blocked | Requires `CENSUS_API_KEY` in the ingestion runtime; release date and five-year period remain distinct |
| HRSA | Adapter supports whole-county, subcounty, population-group, and facility designations | National staging snapshot has not completed source and geography review |
| AHRQ CLH | Approved XLSX and codebook reader implemented and tested | The 2023 database workbook and matching codebook await human approval before snapshot publication |
| Local planning documents | Not yet verified unless a reviewed record says otherwise | “Current local planning evidence: not yet verified.” |

## Chester County investigation

The direct official CDC query used dataset `swc5-untb`, county FIPS `42029`, and:

```text
https://data.cdc.gov/resource/swc5-untb.json?$select=locationid,measureid,measure,datavaluetypeid,datavalue,low_confidence_limit,high_confidence_limit,year&$where=locationid='42029'&$order=measureid,datavaluetypeid
```

The current source returns ten rows representing crude prevalence and crude 95 percent confidence intervals for five 2022 measures: `COLON_SCREEN`, `DENTAL`, `MAMMOUSE`, `SLEEP`, and `TEETHLOST`.

Root cause: the earlier request selected 2023 measures that the current release does not provide for Pennsylvania. The adapter and county record were not missing; the requested measure set excluded the five compatible carried-over measures. The permanent regression test requires Chester County to return these compatible measures and forbids reporting absence as zero.

## Staging and rollback

The branch workflow starts a disposable PostGIS 17 / PostGIS 3.5 database, applies migrations 0001 through 0004, checks migration hashes and append-only guards, rolls back only migration 0004, reapplies it, rebuilds the official geography catalog, validates all county briefs, and then runs typecheck, lint, tests, and a clean public build. The workflow has no deployment permission or production credentials.

Rollback of migration 0004 is defined in `migrations/rollback/0004_nationwide_evidence_activation.down.sql`. Production rollback, if later approved, must restore the application and evidence snapshot independently while retaining all audit history.

## Release boundary and unresolved gates

Milestone 8 must remain NO-GO until the staging workflow passes and the following source approvals are resolved:

- configure the Census Data API key through the approved secret-management path;
- approve and ingest a versioned national HRSA snapshot;
- approve the AHRQ 2023 workbook, codebook, and selected variable contract;
- complete human review for local planning documents;
- resolve or formally accept the supported upstream Next.js/Sharp security dependency issue before any production release.

The internal agent remains disabled. This milestone does not authorize public narrative generation.
