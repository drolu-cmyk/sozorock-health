# Milestone 1: national geography and evidence-data foundation

## Decision boundary

This milestone adds the data and ingestion contracts that a future Explore page, CB-CAP, partner API, and SozoRock Place Intelligence can share. It does not connect those contracts to a public route, change public copy, modify the current map, scrape county websites, or deploy a database.

The implementation lives in `packages/evidence-core`. The PostgreSQL/PostGIS migration is `packages/evidence-core/migrations/0001_national_geography_evidence_foundation.sql`. The future public response schema is `packages/evidence-core/schemas/explore-place-brief.v1.schema.json`.

## Storage model

PostgreSQL with PostGIS is the canonical record. Object storage will hold immutable source artifacts outside the relational database when deployment begins. The database stores the artifact hash, source URL, release metadata, extraction lineage, review state, and structured evidence.

| Record | Grain | Purpose |
| --- | --- | --- |
| `source_catalog` | One approved source family | Publisher, official entry point, host policy, cadence, geography coverage, and limitations |
| `source_version` | One retrieved release or document artifact | Release date, source data period, retrieval time, stale-after date, URL, checksum, schema version, and review |
| `geography` | One authority identifier and vintage | State, county, Census place, ZCTA, USPS ZIP when licensed, or planning region |
| `geography_alias` | One reviewed name for one geography | Official, postal, common, former, and search names without changing the canonical identity |
| `geography_relationship` | One versioned relationship | Containment, intersection, overlap, approximation, membership, or plan applicability |
| `measure_definition` | One source measure | Direction, unit, universe, adjustment, and comparison policy |
| `metric_observation` | One measure, geography, source version, and data period | Value, interval or margin of error, dates, suppression, and review state |
| `planning_document` | One immutable planning-document version | Type, publisher, dates, geography coverage, checksum, and human review |
| `evidence_claim` | One extracted claim | Priority, finding, barrier, asset, action, or data gap, with the exact excerpt and extraction method |
| `evidence_citation` | One locator for one claim | Document, source version, page, section, field, quoted text hash, and review state |
| `ingestion_run` | One adapter execution | Counts, hashes, errors, and whether output was validated, published, failed, or quarantined |
| `evidence_snapshot` | One approved public evidence release | Contract version, policy version, included source versions, checksum, reviewer, and publication time |
| `response_cache` | One place brief for one evidence snapshot and policy | Prevents an old response from being served under a new evidence or policy release |
| `audit_event` | One append-only change event | Actor, action, reason, entity, time, and before/after hashes |

## National geography rules

### Canonical types

- A state uses its two-digit Census state FIPS.
- A county or county equivalent uses its five-digit Census GEOID. The first two digits must be a current state/DC FIPS and the last three digits are the county code.
- A Census place uses its Census place GEOID and published type. It is not assumed to be a postal city or service area.
- A ZCTA uses the current Census five-digit ZCTA identifier. It is described as a ZIP-linked statistical area, not a USPS delivery route.
- A USPS ZIP is stored only after an approved authoritative postal source is available. ZIP input can resolve to a compatible Census ZCTA without asserting that the two are identical.
- A planning region uses the identifier and membership published by its governing source. Its county/place membership is versioned.

### Relationships

ZIP/ZCTA, city/county, planning-region/county, and plan/geography relationships are explicit records. A location is never assigned to one county merely because its centroid falls there. For overlaps, the source, vintage, method, area share, population share when defensible, and caveat are retained.

When a five-digit ZIP input matches a reviewed ZCTA, the resolver returns:

1. the original query as `zip_input`;
2. the selected evidence geography as `zcta`;
3. the ZIP-versus-ZCTA caveat;
4. every reviewed county overlap;
5. separate county planning-evidence contexts.

If no compatible ZCTA is verified, the result is not found for statistical evidence even when the input may be a valid USPS ZIP. It is never borrowed from a neighboring geography.

## Source adapters

Adapters are read-only release planners. They do not publish data directly.

| Adapter | Current foundation behavior |
| --- | --- |
| Census geography | Accepts only reviewer-approved Census artifact URLs. The release gate will validate identifiers, current counts, geometry, and relationship integrity. GitHub ZIP-boundary repositories are explicitly excluded. |
| CDC PLACES | Requires a reviewed release and dataset contract. Measure definitions, eligible population, adjustment, source period, and confidence interval are versioned before observations are accepted. |
| ACS five-year | Requires an approved variable manifest pairing each estimate with its margin of error and universe. |
| HRSA | Keeps HPSA geography, population-group, and facility designations separate. AHRF variables retain their own data years. |
| AHRQ CLH | Preserves release, variable year, and geography grain and blocks unreviewed mixing of incompatible database versions. |
| Local planning documents | Accepts one reviewer-approved official document URL and publisher host at a time. It performs no open-web crawl. Documents and extracted claims remain provisional until human review. |

The adapter host validator permits only the fixed official hosts recorded in the source catalog. Local documents use a separate per-document approved-host gate because valid publishers vary nationwide.

## Refresh and publication workflow

`discovered -> retrieved -> fingerprinted -> normalized -> quality checked -> human reviewed -> snapshot published`

1. An operator registers or selects an approved source version.
2. The adapter creates a release plan containing only HTTPS GET requests to approved hosts.
3. Raw artifacts are written immutably to object storage and hashed with SHA-256.
4. Normalized rows enter staging tables, not the public evidence snapshot.
5. Automated checks validate schema, identifiers, grain, duplicates, foreign keys, dates, missingness, intervals, directionality, and coverage.
6. Failed or unexpected records are quarantined with counts and reasons.
7. A reviewer confirms release metadata, definitions, geography joins, currentness, and limitations.
8. Verified records are assigned to a new evidence snapshot with a manifest and checksum.
9. Publication changes the active snapshot pointer atomically. The previous approved snapshot remains available for rollback and audit.

### Refresh cadence

- Census geography: each official annual vintage and any material official correction.
- CDC PLACES: each official release; no request-time mutation of the approved snapshot.
- ACS five-year: annually after variable-contract review.
- HRSA HPSA/MUA/P: daily retrieval with change detection; publish only after automated validation. AHRF: annually.
- AHRQ CLH: each official release.
- CHA/CHIP/CHNA/CSP: monthly official-source review plus operator-submitted candidates. No uncontrolled national crawl in this milestone.

## Review status

- `verified`: approved for the evidence snapshot and public use.
- `provisional`: retrieved or extracted but awaiting review; never used for a public conclusion.
- `stale`: past its approved freshness window or superseded; visible only with a stale warning and not used as current local-plan evidence.
- `unavailable`: expected source or geography has no usable record.
- `rejected`: failed authority, geography, definition, integrity, or review requirements and is excluded.

Only `verified` evidence can produce a public claim or response-fit assessment.

## Metric direction and comparison

Every measure is classified before values are loaded:

- `adverse`: a higher compatible value may be an adverse signal;
- `protective`: a lower compatible value may be an adverse signal;
- `contextual`: displayed for context and not ranked;
- `unknown`: blocked from ranking until reviewed.

Comparisons require the same measure definition, compatible universe, geography grain, adjustment, unit, and source period. A crude ZCTA estimate is not compared with an age-adjusted county estimate. A source-published benchmark is preferred. Any SozoRock-calculated benchmark is labeled as a calculation and carries its method.

## Local planning claims and citations

A local planning claim cannot be verified unless:

- the source version and planning document are verified;
- its geography is explicit;
- the exact excerpt is retained;
- at least one citation identifies a page or section;
- the quoted passage has a checksum;
- the reviewer and review date are recorded.

If a current plan is absent or not verified, the future Explore response states `not_yet_verified`. It does not infer a local priority from PLACES, ACS, HRSA, AHRQ, a state plan, or an older document.

## Caching

The cache key is:

`contract version + evidence snapshot ID + policy version + canonical geography ID + normalized query options`

Changing a source release, geography vintage, evidence policy, or response contract creates a new cache namespace. Stale cached responses cannot survive a snapshot change. Cached content stores no user health information and no free-text question.

Suggested starting TTLs after deployment:

- location suggestions: 24 hours, keyed by geography vintage;
- deterministic place brief: 24 hours, keyed by evidence snapshot and policy;
- map tiles: immutable by geography/layer version;
- model-written explanation: short-lived and keyed by evidence, prompt, policy, and model versions.

## Audit and operations

Every ingestion and publication records:

- adapter and source;
- input and output checksums;
- records read, accepted, rejected, and quarantined;
- source release and data periods;
- geography and schema versions;
- reviewer and review decision;
- evidence snapshot and policy version;
- rollback or rejection reason.

`audit_event` is append-only; the migration blocks update and delete operations. Database access should use least-privilege roles: ingestion writer, reviewer, snapshot publisher, API reader, and auditor. Public application roles receive read access only to published views, not staging or provisional records.

## Future Explore contract

`explore.place-brief.v1` returns:

- the original query and exact resolved geography;
- evidence geographies and every county overlap;
- geographic caveats;
- current local-planning status, documents, claims, and citations;
- reviewed public observations with direction, uncertainty, release, period, geography, and source;
- what is known, missing, and requires local review;
- bounded SozoRock response-fit results, each requiring human review;
- a strict non-clinical safety classification.

The TypeScript contract is `src/explore-contract.ts`; the language-neutral JSON Schema is `schemas/explore-place-brief.v1.schema.json`. The public UI has not been connected to either contract in this milestone.

## Deployment operations intentionally not performed

The migration file has been created but not executed. No production or development database endpoint, credentials, migration history, or approved change window was supplied for this milestone. The next milestone must provision or identify the PostgreSQL/PostGIS environment, apply the migration through the approved release workflow, record its checksum, and run database-level integrity tests before loading official data.

No nationwide source data was downloaded or loaded. The existing committed CB-CAP artifacts remain unchanged.
