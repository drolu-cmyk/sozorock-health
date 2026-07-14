# CB-CAP stakeholder preview: data methodology and governance

## Purpose and boundary

The County-Based Community Access Platform (CB-CAP) is a public, source-backed stakeholder preview of how county, place, and ZIP-linked health indicators can support accountable planning conversations. It is an initiative of The SozoRock Foundation, Inc. The approved public product and claims boundary is recorded in [`cbcap-stakeholder-preview-source-of-truth.md`](./cbcap-stakeholder-preview-source-of-truth.md).

CB-CAP helps users compare population-level patterns, examine bounded planning scenarios, and organize questions for Community Health Assessment (CHA) and Community Health Improvement Plan (CHIP) work. It does not diagnose, triage, recommend treatment, rank people, determine eligibility, allocate funding, or replace an official CHA or CHIP. The stakeholder preview contains no resident records and no protected health information.

## What the current snapshot contains

The committed snapshot is generated from two authoritative public sources.

| Layer | Source | Current snapshot | Coverage |
| --- | --- | --- | --- |
| Geography | [U.S. Census Bureau TIGERweb](https://tigerweb.geo.census.gov/) | January 1, 2025 vintage | 3,144 county equivalents in the 50 states and the District of Columbia |
| Health and health-related indicators | [CDC PLACES County Data, GIS Friendly Format, 2025 release](https://data.cdc.gov/500-Cities-Places/PLACES-County-Data-GIS-Friendly-Format-2025-releas/i46a-9kgh) | Released December 4, 2025; source years vary by measure | 3,143 county rows matched to Census county FIPS |

The generated manifest is the release record: [`apps/platform/data/source-manifest.json`](../apps/platform/data/source-manifest.json). The current snapshot contains one Census county equivalent without a matched CDC row: Loving County, Texas (FIPS 48301). It remains searchable and displays `Not available`; the pipeline does not turn missing values into zero.

The displayed map uses the separately generated current-vintage boundary snapshot at [`apps/platform/public/data/cbcap-boundaries-2025.json`](../apps/platform/public/data/cbcap-boundaries-2025.json). Its release record is [`apps/platform/data/boundary-manifest.json`](../apps/platform/data/boundary-manifest.json). The boundary gate requires exactly 3,144 unique current county-equivalent geometries and 51 state/District geometries, including the current Connecticut planning regions and Alaska census areas.

CDC states that PLACES values are model-based small-area estimates derived from Behavioral Risk Factor Surveillance System, Census, and American Community Survey data. They are population estimates, not diagnoses or counts of individual people. The 2025 release uses BRFSS 2023 data for most modeled measures and BRFSS 2022 data for measures collected every other year, together with Census and ACS inputs. See the [CDC PLACES overview](https://www.cdc.gov/places/about/index.html) and [methodology](https://www.cdc.gov/places/methodology/index.html).

### Geographic search

The search service uses Census geographic identifiers (GEOIDs) and recognizes:

- states;
- counties and county equivalents;
- incorporated places and census-designated places;
- towns, county subdivisions, and consolidated cities;
- five-digit ZIP Code Tabulation Areas (ZCTAs);
- state, county, and place FIPS/GEOID values.

Users can qualify a duplicate place name with a postal abbreviation or full state name, such as `Springfield IL` or `Springfield Illinois`.

A city or community search result is a Census place, which may not match every local or administrative use of the name. Places and ZCTAs can cross county boundaries. A ZCTA is a Census statistical area used to approximate the distribution of a USPS ZIP Code; it is not a USPS delivery route, and not every valid ZIP Code has a ZCTA. See [Understanding Geographic Identifiers](https://www.census.gov/programs-surveys/geography/guidance/geo-identifiers.html) and [ZIP Code Tabulation Areas](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html).

Place profiles use CDC PLACES dataset `vgc8-iyc4`; ZCTA profiles use `kee5-23sr`. Those profiles are requested on demand. County geography remains the nationwide map and benchmark base. A shared or manually constructed profile link is never treated as proof that a geography exists: CB-CAP validates the identifier against the committed county/state snapshot, CDC PLACES, or an exact TIGERweb result and returns `Not found` for an unrecognized identifier. Caller-supplied labels are not used as official geography names.

## Measures

The refresh script requests each displayed point estimate and its published 95% confidence interval. Source field names are recorded in [`scripts/refresh-cbcap-data.mjs`](../scripts/refresh-cbcap-data.mjs).

| Group | Displayed measures |
| --- | --- |
| Chronic-condition patterns | High blood pressure, diagnosed diabetes, coronary heart disease, stroke, cancer excluding skin cancer, current asthma, chronic obstructive pulmonary disease, depression, obesity |
| Barriers and context | Adults ages 18-64 without insurance, lack of reliable transportation, food insecurity, housing insecurity, utility shutoff or threat, loneliness, any disability |
| Prevention and service-use patterns | Routine annual checkup, dental visit, cholesterol screening, colorectal cancer screening, mammography use |

Measures do not all use the same eligible population or reference year. For example, some screening measures apply only to an eligible age or sex group. The interface preserves the source measure definitions; users must not add unlike measures together and interpret the result as a single prevalence rate.

`Data coverage` is the share of the 21 requested point estimates that are available for a geography. It is not a grade for the geography or the source.

### County, state, and national comparisons

- County profiles show the published county point estimate and confidence interval when available.
- State and national comparison values are population-weighted averages of available county point estimates, using adult population when available and total population otherwise. Records without a usable estimate or population are excluded from that measure's denominator.
- State planning components are medians of the available county percentiles in that state.
- Place and ZCTA planning components are compared with the national county distribution, not with a separate peer-place or peer-ZCTA distribution.

These comparison values are CB-CAP calculations for orientation. They are not CDC-published state or national estimates, and a visible difference is not a statistical-significance finding.

## Demonstration planning pressure

The `CB-CAP demonstration planning pressure` is a transparent orientation aid. It is not a health equity score, government designation, clinical-risk score, prediction, funding formula, or performance grade.

For each geography:

1. Calculate an unweighted mean of available chronic-condition point estimates.
2. Calculate an unweighted mean of the eligible pathway-barrier point estimates: lack of health insurance, lack of reliable transportation, food insecurity, housing insecurity, utility shutoff or threat, and loneliness. At least two eligible pathway-barrier measures are required.
3. Calculate an unweighted mean prevention opportunity as `100 - measure value` across available prevention and service-use measures.
4. Convert each mean to a percentile against the corresponding nationwide county distribution. The percentile is the share of available counties at or below that value, rounded to a whole number.
5. Combine the available component percentiles:

```text
planning pressure =
  (0.45 x chronic percentile
 + 0.35 x barrier percentile
 + 0.20 x prevention-opportunity percentile)
 / sum of available component weights
```

The result is rounded to a whole number. At least two of the three component percentiles are required. If one component is unavailable, the remaining two weights are proportionally reweighted. If fewer than two components are available, the composite result is `null` and the interface shows `Not available`. This prevents a single partial measure group from being presented as a whole-system planning signal.

The weights express a product-design choice for this demonstration. They have not been validated as a causal model. The component view, source estimate, confidence interval, and coverage indicator should be reviewed before the composite orientation aid.

The PLACES disability measure is retained separately as accessibility context. It is excluded from the pathway-barrier percentile and from the composite calculation because disability and disabled residents are not barriers. Any production weighting should be reviewed with affected communities and accessibility experts.

## Planning-scenario mathematics

The scenario tool is an arithmetic planning aid, not a forecast of clinical demand or individual outcomes.

For year `y`:

```text
population-equivalent scenario(y) =
  base adult population
  x (1 + annual population change / 100)^y
  x selected PLACES rate / 100
```

- The base uses adult population when available and otherwise uses total population.
- The base line holds the selected PLACES rate constant and changes only the user-selected annual population assumption.
- Low and high lines use the published lower and upper 95% confidence limits only when the source provides a parseable interval. If a point estimate has no source interval, the demonstration shows the base arithmetic line only and explicitly states that it does not manufacture an uncertainty range.
- The result is a population-equivalent scenario associated with a modeled rate. It is not a count of diagnosed people, future cases, service demand, or people expected to seek help.

The Health Equity Hub capacity illustration is calculated separately:

```text
planned completed pathways per year =
  hub locations
  x pathways prepared per hub per week
  x user-selected operating weeks (24-52; default 48)
  x completion assumption
```

This scenario is for discussing non-clinical readiness, staffing, language support, digital navigation, hub placement, and provider-led pathway capacity. It must not be presented as clinical capacity or an outcome prediction.

## Release-to-release trend comparison

For a selected county, CB-CAP can compare the same named fields across four CDC PLACES county releases:

| Displayed release | CDC dataset |
| --- | --- |
| 2022 | `xyst-f73f` |
| 2023 | `7cmc-7y5g` |
| 2024 | `d3i6-k6z5` |
| 2025 | `i46a-9kgh` |

The view currently supports diagnosed diabetes, high blood pressure, and adults ages 18-64 without health insurance. It is a release-to-release comparison, not a continuous observed time series. Users must confirm each release's source years, model, and definition before interpreting change. The interface does not interpolate missing releases or present the difference as causation.

## Reports and saved views

The stakeholder brief contains only the selected public profile, visible calculations, planning questions, and governance boundary. It is delivered as accessible HTML and can be printed to PDF by the user's browser. Saved views remain in that browser, are limited to eight entries, accept only the platform's own origin, and contain no resident or health-record information.

## How CB-CAP supports CHA and CHIP work

CDC describes a CHA as a comprehensive, systematic picture of community health, contributing factors, and available resources. A CHIP is a long-term, collaborative effort that uses the assessment to address priorities. Both require multiple forms of evidence, community participation, transparent priority-setting, accountable ownership, and evaluation. See [CDC community planning guidance](https://www.cdc.gov/public-health-gateway/php/public-health-strategy/public-health-strategies-for-community-health-assessment-health-improvement-planning.html).

CB-CAP can support that work by helping a planning group:

1. identify a source-cited population signal;
2. compare it with a state or national orientation benchmark;
3. add local records, community experience, assets, workforce context, and partner evidence;
4. frame a planning question;
5. name a possible non-clinical or provider-led action, accountable owner, and measure;
6. revisit the evidence as implementation progresses.

CB-CAP does not decide a community's priorities, inventory every local asset, establish causality, or replace health-department governance. Public PLACES estimates are one secondary-data input. Official planning should also use primary data, local administrative records, resource and workforce inventories, qualitative evidence, and the community's lived experience.

## Systems-intelligence and AI governance

The product frame draws from Oluwabiyi Adeyemo's *Rethinking Rural Governance, Volume 1: From Compliance to Systems Intelligence*. The publication describes a maturity pathway from data capture, through operational execution and structured integration, to systems intelligence and institutional intelligence. It also emphasizes converting dispersed evidence into planning, resource alignment, measurement, transparency, and continuous learning. The publication is a conceptual foundation, not a source for the public health estimates. See the [repository publication](../infrastructure/assets/publications/rethinking-rural-governance-volume-1.pdf).

CB-CAP applies that frame as:

```text
validated source -> visible measure -> comparison -> planning question
-> human-reviewed action -> accountable measure -> learning cycle
```

The current public brief is deterministic: code summarizes only values already present in the selected profile. A future generative AI layer may draft source-cited explanations or organize approved workflows, but it must operate under these controls:

- deterministic code computes measures, benchmarks, scenarios, and coverage;
- only approved, dated sources may be retrieved;
- every generated statement must point back to visible source facts;
- missing information must remain missing;
- prompts, tools, model versions, source versions, and approvals are auditable;
- human review is required before an AI draft becomes a planning recommendation or external report;
- no model may diagnose, triage, prescribe, choose clinical care, predict an individual's health, or expose resident-level information;
- users must be able to distinguish an observed estimate, a CB-CAP calculation, a scenario, and a human-approved decision.

## Missing data, uncertainty, and responsible interpretation

CB-CAP follows these rules:

- Invalid, negative, absent, or unparseable values become `null`, never zero.
- An invalid confidence interval becomes `null`; it is not silently copied from another geography.
- Missing measures are excluded from benchmarks and component means.
- Partial coverage remains visible through the coverage percentage.
- A geography without a profile remains searchable and receives an explicit no-data state.
- Exports retain geography identifiers, coverage, displayed indicators, and the source release. Unavailable indicators remain blank rather than becoming zero.

Important limitations:

- PLACES values are modeled estimates and carry model uncertainty.
- Counties, places, and ZCTAs are ecological units; their averages do not describe every person or neighborhood.
- County-level patterns can conceal differences within a county.
- Reference years and eligible populations vary by measure.
- The demonstration does not yet include a verified national inventory of local programs, providers, workforce, broadband, transportation routes, service capacity, budgets, or community preferences.
- Correlation or geographic overlap does not establish cause.
- Ranking differences should not be treated as statistically meaningful without appropriate analysis of uncertainty and method.

## Reproducing and reviewing the snapshot

Requirements: Node.js 24 or newer, npm 10 or newer, and network access to Census TIGERweb and CDC data APIs.

```bash
npm ci
npm run refresh:cbcap-data
npm run refresh:cbcap-geometries
npm test
npm run typecheck
npm run lint
npm run build:platform
```

The refresh command:

1. requests all Census county equivalents and filters to the 50 states and District of Columbia;
2. requests selected CDC PLACES county fields;
3. joins rows on five-digit county FIPS;
4. preserves point estimates, confidence intervals, and missing values;
5. calculates the documented demonstration components;
6. writes `county-planning.json` and `source-manifest.json`;
7. fails if the output does not contain exactly 3,144 unique, valid county FIPS values.

The geometry refresh separately requests current Census TIGERweb county and state boundaries, applies the documented display simplification, writes the boundary snapshot and manifest, and fails unless all current county-equivalent FIPS values are present exactly once.

Before accepting a refresh, a reviewer should:

- confirm the source landing pages, dataset IDs, release dates, and geography vintage;
- confirm `actualCountyEquivalents`, `uniqueFips`, `matchedCountyCount`, and `unmatchedCdcRows` in the manifest;
- inspect any changed or newly unmatched geography;
- review changes in field definitions, denominator populations, methodology, and source years;
- verify confidence-interval ordering and that missing values remain `null`;
- run the national-data tests and production build;
- inspect county, state, place, and ZCTA profiles in the interface;
- review exports and no-data states;
- record any formula or weight change in this document before release.

The manifest SHA-256 hash verifies the generated county JSON at that moment. It proves file integrity, not the correctness or permanence of the upstream data. A source revision requires a new generated timestamp, hash, test run, and human review.

## Stewardship

Questions about source interpretation, corrections, or use of the public demonstration should be directed to The SozoRock Foundation, Inc. at `contact@sozorockfoundation.org`.
