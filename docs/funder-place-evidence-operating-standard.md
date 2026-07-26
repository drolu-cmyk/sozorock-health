# SozoRock Place Intelligence operating standard

Status: internal source-of-truth policy for review. It does not authorize public release.

## Purpose

SozoRock Place Intelligence turns public data into clear, credible, and actionable evidence for local decision-making, health equity, and measurable progress. It supports residents, community institutions, health departments, licensed providers, educators, funders, and public-sector partners without becoming a clinical service or inventing community need.

## The decision sequence

Every place brief must follow one auditable sequence:

**Verified place -> verified evidence -> practical barrier -> possible non-clinical response -> appropriate partner role -> measurable progress**

“Insufficient evidence” and “local review required” are correct outcomes. A SozoRock response must never be recommended from modeled population estimates alone.

## Place rules

- Prefer the most local valid geography.
- Name the exact geography and source authority: USPS ZIP input, Census ZCTA, Census place, county FIPS, state, planning region, tract, facility, or source-defined designation.
- Never silently convert county evidence into ZIP, ZCTA, city, or neighborhood evidence.
- Explain ZIP-to-ZCTA approximation and cross-county overlap where it affects interpretation.
- Do not compare incompatible geographic levels or time periods.

## Evidence rules

- Lead with the strongest three to five reviewed adverse signals. Do not publish a long measure inventory as a priority list.
- A favorable preventive-service measure cannot become a problem because it is numerically high.
- Separate verified local CHA, CHIP, CHNA, or CSP evidence from national-model context.
- Keep publisher, source URL, source record ID, release date, data period, retrieval date, geography, method, confidence, and limitations with each claim.
- Treat missing, suppressed, unavailable, and stale data as different states. None of these states means zero.
- Label modeled estimates as modeled estimates. They are not patient data, diagnosis, causation, or proof of a local priority.

## Equity rules

- Show rurality, income, race or ethnicity, age, disability, language, digital access, or other disparities only when a reviewed source explicitly supports the population, geography, and period.
- Do not infer individual characteristics or risk from area-level data.
- Do not use an average to hide material local variation when a valid disaggregation exists.
- Explain suppression and small-population limitations in plain language.

## Decision-ready presentation

Each output should answer:

- What is the resolved place?
- What does the latest verified local plan say?
- What do current public data add?
- What is improving, what needs attention, and what is missing?
- What practical barriers are explicitly supported?
- Which response may fit, who should review it, and how could progress be measured?

Maps must earn their space. A map may show only valid data at the displayed geography, with a legend, data period, source, and text alternative. Every brief must also work in a mobile and low-bandwidth view.

## Responsible agent use

- The assistant may answer only from approved, stored evidence for the selected place.
- No uncontrolled live web search is allowed in a public answer.
- Every answer must include citations, source and data dates, geographic scope, confidence, missing evidence, and caveats.
- The assistant does not diagnose, triage, recommend treatment, infer individual risk, or claim causation from population measures.
- Generated briefs remain editable evidence products, not automatic grant claims or clinical recommendations.

## Public-health and funder uses

The system may support Community Health Assessment and Community Health Improvement Plan work, hospital Community Health Needs Assessment and community-benefit planning, rural health transformation, data modernization, partnership development, funding conversations, and progress tracking. It must not claim endorsement, adoption, or results that have not been verified.

## Publication gate

Evidence may be public only when the exact geography is resolved, the source version is current, definitions are reviewed, provenance is complete, local claims have verified page or section citations, required human review is closed, and the release candidate passes security, accessibility, performance, and rollback gates.
