# CB-CAP evidence registry and systems-intelligence contract

## Purpose

The public CB-CAP release must make three things distinguishable:

1. **Evidence displayed now** — a committed or on-demand official public source that supplies the visible geography or measure.
2. **Official sources prepared for governed ingestion** — a credible future input whose values are not yet displayed.
3. **A CB-CAP calculation or planning scenario** — a transparent transformation of visible source evidence, never an observed fact or automated decision.

The machine-readable contract is [`apps/platform/data/evidence-registry.json`](../apps/platform/data/evidence-registry.json). Its TypeScript contract and release checks are in [`apps/platform/app/lib/evidence-registry.ts`](../apps/platform/app/lib/evidence-registry.ts), and the public read-only endpoint is `GET /api/evidence`.

Listing a source does not mean that CB-CAP has ingested it. Every entry carries an `integrationStatus` and a coverage status. Sources marked `planned-ingestion` must remain `planned-not-displayed` until a versioned ingestion, definition review, geography join, coverage audit, and release approval are complete.

## Nationwide geography search

The release uses three official federal geography services for different purposes.

| Search object | Source | Current behavior | Important boundary |
| --- | --- | --- | --- |
| 50 states and the District of Columbia | U.S. Census Bureau TIGERweb | 51 committed state records | State health summaries are derived from county estimates. |
| Counties and county equivalents | U.S. Census Bureau TIGERweb | 3,144 committed current county equivalents | County FIPS is a five-digit Census identifier. |
| Incorporated places and Census-designated places | U.S. Census Bureau TIGERweb | Authoritative lookup by name or seven-digit place GEOID | A Census place can differ from a postal city and can cross county boundaries. |
| Consolidated cities and county subdivisions, including many towns | U.S. Census Bureau TIGERweb | Authoritative lookup by name or GEOID | Census legal/statistical geography may differ from local usage. |
| Named populated communities | U.S. Geological Survey GNIS | Fallback official-name lookup when Census place/subdivision search returns no result | A GNIS populated place is a named point, not a statistical, municipal, postal, provider-market, or service-area boundary. |
| ZIP-linked areas | U.S. Census Bureau TIGERweb | Authoritative ZCTA lookup; compatible CDC evidence is checked after selection | A ZCTA is not a USPS ZIP Code delivery route, and not every ZIP Code has a ZCTA. |

This separation fixes a material public-search gap. For example, `Delmar, NY` is available in GNIS as a populated place even when current TIGERweb place layers return no result. CB-CAP can verify and display the named community, GNIS identifier, state, county name, and source. It must **not** transfer Albany County estimates to Delmar or imply that GNIS defines a Delmar statistical boundary. The profile therefore remains geography-only unless a compatible, officially joined local statistical geography is added later.

Additional Census reference material:

- [Geography APIs and data](https://www.census.gov/data/developers/geography.html)
- [Geographic identifiers and GEOIDs](https://www.census.gov/programs-surveys/geography/guidance/geo-identifiers.html)
- [ZIP Code Tabulation Areas](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html)
- [GNIS](https://www.usgs.gov/tools/geographic-names-information-system-gnis)

## Current evidence

The public health and health-related evidence currently comes from CDC PLACES 2025 model-based estimates.

- County evidence is a committed snapshot with 3,143 matched source rows across 3,144 current county equivalents.
- Place and ZCTA evidence is requested only after an exact Census identifier is verified.
- State values are population-weighted summaries derived from the committed county estimates.
- Missing estimates remain missing. They are not replaced with zero, borrowed from a neighboring geography, or inferred from a name.
- PLACES estimates are area-level model-based estimates. They are not diagnoses, facts about a person, observed service demand, clinical capacity, or program results.

The release manifest remains the authority for the committed county snapshot and its SHA-256 integrity hash: [`apps/platform/data/source-manifest.json`](../apps/platform/data/source-manifest.json).

## Barrier and system-capacity taxonomy

The evidence registry keeps three classes separate.

- **Pathway barriers displayed now:** lack of insurance, lack of reliable transportation, food insecurity, housing insecurity, utility shutoff or threat, and loneliness where the selected CDC contract supplies the measure.
- **Accessibility context displayed now:** disability. Disability and disabled people are not barriers. The measure is excluded from the pathway-barrier percentile and composite calculation.
- **System-capacity context prepared for future ingestion:** digital connectivity, workforce and service capacity, and rural/geographic context. These are not current findings.

Future source preparation currently identifies:

- U.S. Census Bureau ACS five-year estimates for selected demographic, language, housing, income, vehicle, device, subscription, and community-condition variables, with margins of error and universe definitions preserved;
- HRSA Area Health Resources Files for selected county workforce, facility, training-pipeline, and delivery-system context;
- HRSA daily shortage-area downloads for HPSA and MUA/P designations, preserving designation type, discipline, population or geography, status, and dates;
- FCC Broadband Data Collection for availability context, kept separate from adoption, affordability, devices, skills, service quality, and lived experience; and
- USDA Economic Research Service Rural-Urban Continuum Codes for county peer context, never as a deficit label or description of every community within a county.

No value from these planned sources is displayed by the current registry.

## CHA and CHIP support

CDC describes a Community Health Assessment (CHA) as a systematic, comprehensive picture of community health, contributing factors, and resources. A Community Health Improvement Plan (CHIP) is a long-term, collaborative effort using assessment evidence to address priorities. See [CDC community planning guidance](https://www.cdc.gov/public-health-gateway/php/public-health-strategy/public-health-strategies-for-community-health-assessment-health-improvement-planning.html).

CB-CAP supports an accountable sequence:

`Assess -> Validate -> Prioritize -> Act -> Measure and learn`

CB-CAP can surface source-cited estimates, comparisons, coverage, missingness, questions, owners, safeguards, measures, and review dates. People and public institutions must add local primary data, administrative records, assets, resources, and community experience; interpret the evidence; set priorities; approve actions; and evaluate implementation.

CB-CAP does not decide priorities, establish causality, allocate funding, inventory every local asset, or replace community participation, health-department governance, an official CHA, or an official CHIP.

## Systems-intelligence operating model

The product architecture adapts the maturity and governance ideas in Oluwabiyi Adeyemo's *Rethinking Rural Governance, Volume 1*. The publication is a conceptual foundation, not a source for the public health estimates.

The required traceability chain is:

`Evidence -> Interpretation -> Lever`

No interpretation or planning lever may be published without source identifiers, status, method, limitations, and a human-review rule. The typed `DerivedInsightTrace` contract and `validateDerivedInsightTrace` release check enforce that boundary for future derived insight work.

The maturity path is:

`Data Capture -> Operational Execution -> Structured Integration -> Systems Intelligence -> Institutional Intelligence`

The tiers are `Foundational`, `Integrative`, and `Adaptive`. The current public release is represented only as **Structured Integration**: versioned public evidence, deterministic comparisons, visible methods, bounded scenarios, planning workflow, and source-aware briefs. It does not claim full systems or institutional intelligence.

The operating components are governed data architecture, performance analytics, a governed feedback loop, workforce capability, and public transparency. Only the public source architecture and transparency foundation are current. Performance work is bounded to comparisons and scenarios. Feedback-loop and workforce-capability data are planned and not displayed.

## Scenario and forecast boundary

The public scenario is a sensitivity analysis, not a forecast of clinical demand or health outcomes.

It may:

- apply transparent user-selected assumptions to a displayed source estimate;
- show a population-equivalent planning range when a compatible source confidence interval exists;
- support discussion of non-clinical readiness, hub placement, digital support, language access, workforce preparation, and provider-led pathway capacity; and
- export the source, vintage, method, assumptions, geography, and limitations.

It must not:

- predict diagnoses, individual outcomes, future cases, service demand, clinical capacity, or program performance;
- present a scenario as an observed count, causal estimate, government designation, funding formula, or recommended allocation;
- manufacture an uncertainty range when the source supplies no compatible interval; or
- turn missing or suppressed data into zero.

Any future AI-assisted explanation is downstream of deterministic evidence and must preserve the same traceability contract. Human review remains required before an AI draft becomes a planning recommendation, public report, or operational decision.
