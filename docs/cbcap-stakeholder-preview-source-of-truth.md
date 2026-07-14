# CB-CAP stakeholder preview: source of truth

Status: approved product and public-claims contract for the CB-CAP stakeholder preview. Changes to the boundaries in this document require Oluwabiyi Adeyemo's approval.

## Product definition

The County-Based Community Access Platform (CB-CAP) is a county-based, privacy-preserving systems-intelligence platform. It connects health measures, practical barriers, local readiness, workforce context, and planning evidence so public agencies, institutions, funders, and community partners can move from fragmented information to accountable action.

CB-CAP is one part of SozoRock Health's wider non-clinical health, workforce-readiness, and systems infrastructure. It supports Health Equity Hub planning, Health Access Day planning, Community Health Assessment (CHA) and Community Health Improvement Plan (CHIP) work, public-sector modernization, AI readiness, cybersecurity readiness, and interdisciplinary workforce development.

CB-CAP does not diagnose, triage, recommend treatment, rank people, determine eligibility, allocate funding, replace county judgment, or replace an official CHA or CHIP.

## Approved stakeholder promise

**See the pattern. Test a response. Build a fundable plan.**

CB-CAP brings public health estimates, practical barriers, local capacity questions, and planning evidence into one accountable workspace for counties and partners.

Public estimates guide questions—not diagnoses, rankings, or final county priorities.

## Current stakeholder preview

The current release must visibly provide:

- all 50 states and the District of Columbia;
- all 3,144 current county equivalents, with current Census FIPS and GEOIDs;
- search for states, counties, Census places, towns and county subdivisions, consolidated cities, and ZIP Code Tabulation Areas (ZCTAs);
- county-level CDC PLACES 2025 model-based estimates and published confidence intervals where available;
- on-demand CDC PLACES profiles for compatible places and ZCTAs;
- nationwide county choropleths, selected-place profiles, source-linked comparisons, release-to-release views, bounded planning scenarios, CHA/CHIP evidence organization, saved views, and exports;
- visible source, release, coverage, missingness, and calculation disclosures;
- a clear distinction between county evidence and any place or ZCTA whose compatible health profile is unavailable.

A ZCTA is a Census statistical area and must be described as a ZIP-linked area, not as a USPS delivery route. A city, place, or ZCTA may cross county boundaries and must not be silently assigned to one county.

## Evidence-status contract

Every quantitative or generated output must identify one of these states:

| Status | Meaning | Public treatment |
| --- | --- | --- |
| Published public estimate | A dated value from an identified authoritative public source | Show source, vintage, eligible population, confidence interval when available, and missingness |
| Derived planning view | A deterministic CB-CAP calculation using visible public estimates | Show the method and state that it is not an official designation, grade, or validated causal model |
| User assumption | A value selected by the viewer for a planning exercise | Keep it editable and label it as an assumption |
| Scenario output | Arithmetic based on a published estimate and user assumptions | Call it a modeled planning range; never call it predicted demand or a clinical forecast |
| Planned governed feed | A future data source or operational integration that is not active in the current release | Label it planned; do not blend it into current results |
| No verified data | A verified geography without compatible evidence for a measure | Preserve the gap; never convert it to zero |

## Decision workflow

The public workspace translates the systems-intelligence approach in *Rethinking Rural Governance, Volume 1* into:

`Ingest -> Validate -> Compare -> Draft -> Human review -> Approve -> Monitor`

The public-facing operating principle is:

**AI drafts. People decide.**

The current public brief is deterministic. Runtime AI-generated briefing, automated workflow execution, user roles, approvals, and audit history are planned governed capabilities until their production controls and review gates are active.

## CHA and CHIP use

CB-CAP helps a planning group organize:

- public evidence;
- community knowledge and lived experience;
- existing assets and gaps;
- a transparent priority question;
- a possible non-clinical or provider-led response;
- an accountable owner;
- a baseline, target, and review date.

County and community partners retain priority-setting and implementation authority. Public estimates are one input and must be tested against local records, resource and workforce inventories, qualitative evidence, and community participation.

## Future governed feeds

The following remain planned integrations until they are operational, verified, and governed:

- American Community Survey indicators for demographics, language, poverty, vehicle access, and connectivity;
- Health Resources and Services Administration shortage-area and workforce data;
- Federal Communications Commission broadband availability;
- U.S. Department of Agriculture food-access measures;
- state-verified provider licensure and availability;
- local CHA and CHIP documents with page-level citations;
- Health Equity Hub, Health Access Day, workforce, and provider-pathway activity;
- governed community-input records;
- validated peer-county methods and predictive models;
- runtime AI brief generation, workflow automation, roles, review approvals, and audit history.

The interface may preview how these capabilities will work, but must label them as planned and keep them out of current evidence totals.

## Approved information architecture

The primary navigation is decision-oriented:

- National view
- Place profile
- Barriers & priorities
- CHA/CHIP workspace
- Scenarios
- Briefs & exports
- Data & methods

The first viewport is a working decision room. It must show the geography search, primary map or list alternative, layer controls, selected-place context, evidence status, and a stakeholder-brief action before long-form explanation.

## Design direction

The approved primary visual direction is the high-clarity, data-first operational system shown in the third approved concept, with the editorial warmth of the second concept. The interface should feel calm, precise, public-interest, and ready for a county briefing.

Avoid oversized marketing heroes, generic card grids, decorative statistics, fabricated activity, excessive gradients, glossy AI motifs, and technical language without a decision purpose.

Desktop, tablet, and mobile must preserve the same evidence meaning. Mobile may replace dense map controls with accessible drawers or a list view, but must not remove source context, missing-data states, or decision boundaries.

## Canonical release

The canonical public address is `https://cbcap.sozorockfoundation.org`.

The dedicated CB-CAP release workflow, protected `main` branch, production review gate, nationwide data tests, security checks, and live-domain verification are required for every production release.
