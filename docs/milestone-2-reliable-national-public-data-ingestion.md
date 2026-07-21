# Milestone 2 — Reliable national public-data ingestion

Status: implemented behind the Milestone 1 evidence contract. No public UI, route, or deployment changes are included.

## Intended use and grain

The ingestion layer supplies source-traceable, non-clinical observations to future place briefs. Its primary key is the combination of source version, original source record, measure definition, and exact source geography. County, Census place, ZCTA, USPS ZIP, state, planning region, population group, and facility records are never treated as interchangeable.

## Implemented source adapters

| Source | Production endpoint | Supported grain | Refresh rule | Important boundary |
| --- | --- | --- | --- | --- |
| CDC PLACES 2025 | Separate Socrata datasets for county, Census place, and ZCTA | County, Census place, ZCTA | Weekly release check; 7-day response cache | Modeled estimates are not diagnoses, local counts, or local planning priorities. Each measure retains its own source year. |
| ACS 2020–2024 five-year | Census Data API | State, county, Census place, ZCTA | Monthly release check; 30-day response cache | The runtime requires `CENSUS_API_KEY`. The key is excluded from observation URLs and cache metadata. Estimate universe, variable ID, vintage, and margin of error are retained. |
| HRSA HPSA | Official daily primary-care, dental, and mental-health CSV artifacts | Exact source designation; current adapter publishes county observations only for active, single-county geographic HPSAs | Daily; 22-hour response cache | Population-group, facility, and subcounty rows remain separate and are never promoted to a whole-county finding. |
| AHRQ CLH September 2025 | Official annual XLSX files and codebooks | County or source-labeled ZIP Code, selected explicitly | Monthly release check | Import remains `unavailable` until an approved codebook and XLSX reader are registered together. AHRQ ZIP Code rows are not relabeled as Census ZCTAs. |

Official references:

- CDC PLACES current release notes: https://www.cdc.gov/places/current-release-notes/index.html
- CDC county dataset: https://data.cdc.gov/d/swc5-untb
- CDC ZCTA dataset: https://data.cdc.gov/d/qnzd-25i4
- Census ACS 2024 five-year API: https://api.census.gov/data/2024/acs/acs5.html
- HRSA shortage-area downloads: https://data.hrsa.gov/data/download?titleFilter=Shortage+Areas
- AHRQ Community-Level Health Database: https://www.ahrq.gov/data/innovations/clh-data.html

## Storage and provenance

Migration `0002_reliable_public_data_ingestion.sql` extends the Milestone 1 PostgreSQL/PostGIS model.

Every observation stores:

- the original source record identifier;
- a public official source URL without credentials;
- source version and content hash;
- exact geography ID and source geography level;
- release date and data-period dates as different fields;
- value, uncertainty or margin of error, and suppression reason;
- source-specific metadata needed to interpret the record;
- a reviewed measure definition, including whether a higher value is favorable, adverse, neutral, or context-dependent.

`source_import_state` records each adapter attempt, source version, idempotency key, status, counts, success time, failure time/code/message, source release, source period, and cache disposition. `source_http_cache` stores cache metadata and an object-store key; large raw responses belong in encrypted object storage, not in PostgreSQL rows.

## Refresh and caching design

`PUBLIC_DATA_REFRESH_SCHEDULES` provides EventBridge-compatible schedules:

- PLACES: weekly metadata/content check;
- ACS: monthly release check;
- HRSA: daily refresh;
- AHRQ CLH: monthly release check.

The scheduler invokes a source-specific worker. The worker obtains a distributed lock on adapter, release, geography, and measure scope; fetches with `ETag` and `Last-Modified` when available; validates content; computes a SHA-256 content hash; and runs a transactional upsert. The deterministic idempotency key includes the adapter version, release key, geography authority/kind/vintage, and requested measures. Re-running the same job returns the recorded import without fetching or duplicating observations. A changed release key creates a new source version.

Conditional response caching returns one of `miss`, `hit`, `revalidated`, or `stale_fallback`. If an official source is temporarily unavailable, an expired cached response may be retained only with source status `stale`. With no usable cache, the source is `unavailable` or `failed`; the system does not substitute another geography or source silently.

For AWS execution, small API calls fit Lambda. The 35+ MB HRSA artifacts and AHRQ workbooks should run in a memory-sized Lambda or an ECS/Fargate ingestion worker. Raw artifacts are stored in versioned, encrypted S3 with the object hash recorded in PostgreSQL. Secrets such as `CENSUS_API_KEY` belong in AWS Secrets Manager and are injected only into the worker process.

## Validation and audit

The automated suite checks:

- exact Census county FIPS matching;
- county, Census place, and ZCTA endpoint separation;
- original source IDs and official URLs;
- release date versus underlying data period;
- positive preventive-service directionality;
- ZCTA rejection of county-only rows;
- stale fallback labeling;
- HRSA designation-type and component-grain separation;
- AHRQ access/parser gating;
- idempotent replay.

Every successful or failed import is inspectable through `source_import_state`. Source-version, observation, and import records are immutable by identity; replacements create new versions. The existing append-only audit table records publication, review, stale, and rejection decisions. Only verified evidence is eligible for a future public brief.

## Operational status contract

The future Explore service consumes `publicSourceStatus()`:

- `Current` — source is within its freshness window;
- `Stale source` — cached evidence exists but the refresh failed or freshness window expired;
- `Source unavailable` — no approved usable version exists;
- `Refresh failed` — an import attempt failed validation or transport;
- `Refreshing` — a job is active and has not published.

No state is converted to `Current` merely because older rows are present.

## Known configuration gates

- A Census API key must be added to the ingestion runtime as `CENSUS_API_KEY` before live ACS imports can run.
- AHRQ CLH requires an approved XLSX reader and codebook contract per release. This implementation intentionally reports `unavailable` until that gate is satisfied.
- This milestone does not discover or ingest CHA/CHIP/CHNA/CSP documents; that remains a later reviewed-document workflow.
- No database migration was executed against a live environment in this milestone.
