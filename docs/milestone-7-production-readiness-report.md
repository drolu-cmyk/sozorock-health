# Milestone 7 production readiness report

Evaluated: July 23, 2026 (America/New_York). Scope: national place-evidence operations only. No deployment or public release was performed.

## Executive decision

**Release recommendation: NO-GO.**

The evidence policies, geography safeguards, approved-source adapters, controlled local-document workflow, internal agent safety, responsive three-view interface, and deterministic tests are strong. The system is not ready to become the national public source of record because the public Explore route still bypasses the audited evidence repository; production persistence, monitoring, rate and cost controls, immutable agent logs, and verified local plans are incomplete; ACS and AHRQ ingestion are not operational; and the production dependency audit still reports high-severity findings.

This is a governance decision, not a design judgment. The public interface can demonstrate the intended experience, but it must not present the unfinished evidence path as production-grade national intelligence.

## Control results

| Control | Result | Evidence |
|---|---|---|
| Approved-source adapters | Pass | CDC PLACES, ACS, HRSA, and AHRQ adapters preserve source identifiers, URLs, release dates, data periods, geography, cache state, and failure state. |
| Caching and retries | Pass | Conditional requests, timeouts, three bounded attempts, idempotent imports, and visible stale fallback are implemented and tested. |
| Geography integrity | Pass | ZIP input, ZCTA, Census place, county FIPS, state, and planning-region concepts are typed separately; county evidence cannot pass as ZCTA evidence. |
| Measure directionality | Pass | Favorable preventive measures cannot become adverse priorities by default. |
| Local-document review | Pass | Ambiguous or provisional candidates, claims, citations, and current-plan designations remain internal until named human review. |
| Grounded agent safety | Pass | Six strict tools use stored evidence only; live-web retrieval, medical advice, unsupported action, ZIP/county confusion, and favorable-as-adverse prompts are refused or returned as insufficient evidence. |
| Accessibility and mobile | Pass for current candidate | Interactive review found one H1, one main landmark, no unlabeled inputs, no horizontal overflow, at least 44px mobile button width, and no browser errors. Ten five-place desktop/mobile tests passed. |
| Map behavior | Pass for current candidate | The official county boundary and one MapLibre canvas rendered for all five evaluation counties on desktop and mobile. No decorative road or unsupported heat layer is used. |
| Build and code quality | Pass | Repository typecheck, zero-warning lint, all workspace tests, and the optimized public-site build passed. Explore is 15 kB route code and 122 kB first-load JavaScript. |
| Persistent evidence repository | Fail | The reference repositories are in-memory; no production repository adapter or immutable source-run ledger is configured. |
| Public evidence path | Fail | The public Explore API still queries a live source endpoint directly instead of a reviewed, versioned publication snapshot. |
| Scheduled production refresh | Fail | Cadence and a review-only health workflow exist, but no persistent national ingestion runner publishes reviewed snapshots. |
| Public rate and request limits | Fail | Explore has no enforced per-client limit, upstream concurrency ceiling, or bounded source-request budget. |
| Monitoring and incident correlation | Fail | Required signals and escalation are documented, but production dashboards and alerts are not provisioned. |
| Agent authentication and immutable logs | Fail | The assistant remains internal-only; authenticated tool access, immutable executions, retention, and incident correlation are not configured. |
| Cost controls | Fail | HTTP caching exists, but source-job ceilings, model budgets, spend alarms, and fail-closed cutoffs are not configured. |
| Security release gate | Fail | The full repository security scan was not started. The production dependency audit reports 3 unresolved high-severity findings across the Sharp and fast-uri chains. |

## Five-place acceptance results

All results use exact Census county FIPS and must remain county-level.

| Place | Geography and UI | Current source health | Local planning evidence | Release status |
|---|---|---|---|---|
| Albany County, New York (36001) | Pass | CDC: 4 reviewed adapter observations; ACS: unavailable; HRSA: available with 0 whole-county primary-care designations; AHRQ: unavailable | Official Albany data page and 2025 Capital Region CHNA candidate are in the review workflow. A current Albany County plan is not yet formally verified. | Blocked |
| Schenectady County, New York (36093) | Pass | CDC: 4; ACS: unavailable; HRSA: available with 0 whole-county designations; AHRQ: unavailable | Candidate evidence is awaiting formal human review. | Blocked |
| Montgomery County, New York (36057) | Pass | CDC: 4; ACS: unavailable; HRSA: available with 0 whole-county designations; AHRQ: unavailable | The reviewed candidate is hospital/service-area evidence, not a verified county plan. | Blocked |
| Chester County, Pennsylvania (42029) | Pass | CDC adapter available but 0 requested observations; ACS: unavailable; HRSA: available with 0 whole-county designations; AHRQ: unavailable | County assessment evidence is awaiting formal review; no current county CHIP is publicly designated by this system. | Blocked |
| Bexar County, Texas (48029) | Pass | CDC: 4; ACS: unavailable; HRSA: available with 0 whole-county designations; AHRQ: unavailable | Hospital implementation-strategy evidence is not a verified Bexar County plan. | Blocked |

### Interpretation limits

- CDC’s December 2025 PLACES release uses 2023 BRFSS data for most measures and 2022 data for five measures. Official release notes state that Pennsylvania lacks the 2023 BRFSS estimates used by the requested measures; the Chester result is missing, not zero. See [CDC PLACES current release notes](https://www.cdc.gov/places/current-release-notes/index.html).
- CDC PLACES values are modeled area estimates. They are not patient records, diagnoses, causes, or proof that a local planning body selected a priority. See [CDC PLACES methodology](https://www.cdc.gov/places/methodology/index.html).
- The latest ACS five-year release is available publicly, but this environment has no configured Census API key. The adapter correctly reports unavailable instead of returning incomplete results. See [Census 2020–2024 ACS five-year release](https://www.census.gov/newsroom/press-releases/2026/embargo-acs-5-year-estimates.html).
- HRSA’s observed zero is limited to active whole-county primary-care designations under the adapter contract. It does not rule out facility, population-group, or subcounty shortage designations. See the [HRSA shortage-area dashboard](https://data.hrsa.gov/topics/health-workforce/shortage-areas/dashboard?tab=hpsaHeader).
- AHRQ Community-Level Health remains unavailable until the September 2025 workbook and codebook have an approved reader and variable contract. See [AHRQ Community-Level Health Data](https://www.ahrq.gov/data/innovations/clh-data.html).
- No pilot’s local planning claims are approved for public presentation by this milestone. Source-text matching is not the same as formal verification.

## Test results

- Evidence-core typecheck: pass.
- Evidence-core tests: 49 passed, 0 failed.
- Full repository typecheck: pass.
- Full repository lint: pass with zero warnings.
- Full workspace tests: 180 passed, 0 failed.
- Public production build: pass.
- Five-place desktop/mobile Playwright suite: 10 passed, 0 failed.
- Interactive browser review: pass for Albany Brief and Map at desktop and mobile viewports; no console warnings or errors.
- Dependency audit: fail; 3 reported production vulnerabilities, all high severity. Next.js, Playwright, and PostCSS were updated and the build was revalidated, but supported non-breaking remediation is not yet available for the remaining Sharp and fast-uri chains.
- Full repository security scan: not run because the native scan was not started.

## Unresolved issues required before release

1. Implement a persistent production evidence repository and immutable import and publication audit ledger.
2. Make public Explore read only reviewed publication snapshots; remove uncontrolled live evidence from the response path.
3. Configure the Census API key and validate the newest ACS variable contract.
4. Approve the AHRQ workbook reader, codebook, and release-specific variables.
5. Complete human verification for local planning evidence; never use a regional or hospital document as a county plan.
6. Add public rate limits, upstream concurrency and payload limits, source-job request budgets, and abuse monitoring.
7. Provision source-age, outage, cache, latency, map, review-queue, agent, and wrong-claim alerts.
8. Implement authenticated agent tools, immutable execution logs, retention, and a fail-closed cost budget.
9. Resolve or formally accept supported upstream dependency fixes and complete the whole-repository security scan.
10. Repeat the full five-place and adversarial acceptance suite against the production-like repository and release snapshot.

## Rollback plan

The last approved application artifact, reviewed evidence snapshot, source manifest, boundary manifest, and configuration version must be retained together. Application and evidence snapshots must roll back independently. Feature flags must separately disable the assistant, exports, a source, a map layer, or an affected geography. A rollback must purge affected caches, verify the five evaluation places plus the incident geography, and append an audit event with actor, reason, and before/after hashes. Audit history must never be rolled back or overwritten.

## Release boundary

No migration was run. No public data was published. No branch was deployed. The new workflow produces internal review artifacts only and cannot release itself.
