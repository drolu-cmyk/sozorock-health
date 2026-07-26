# Milestone 5 — Grounded place-evidence agent infrastructure

Status: internal only; public assistant disabled  
Policy version: `place-evidence-agent.v1`  
Completed: July 22, 2026

## Scope delivered

This milestone adds a retrieval-grounded planning assistant over the approved evidence store. It does not add a general chatbot, a public API route, live-web search, model-generated facts, or a public user interface.

The runtime has no network client. Its only dependency is a `PlaceAgentRepository` backed by a versioned stored-evidence snapshot. Retrieval is fail-closed:

- a geography must be reviewed and official;
- an observation, measure definition, and source version must be verified;
- an observation must retain the selected geography level;
- stale evidence is excluded by default and can only be displayed with an explicit stale label;
- a local plan must be county-specific, verified current, human-reviewed, and backed by verified page- or section-level citations;
- regional, hospital-specific, provisional, stale, unavailable, and rejected documents are not presented as a county's current plan;
- population observations cannot establish individual risk or causation.

## Grounded response contract

Every tool and assistant response returns:

| Field | Purpose |
| --- | --- |
| `answer` | Plain-language answer bounded by available evidence. |
| `citedEvidence[]` | Publisher, title, official URL, source version, dates, geography, locator, review status, and freshness. |
| `sourceAndDataDates[]` | Release date, underlying data period, retrieval date, and freshness kept separate. |
| `geographicScope` | Selected geography and the exact evidence geography identifiers. |
| `confidence` | High, moderate, or low with a written rationale. |
| `missingEvidence[]` | Evidence required before a stronger conclusion can be made. |
| `caveats[]` | Geography, modeling, freshness, and decision-use limitations. |
| `nonClinicalBoundary` | The fixed boundary against diagnosis, triage, treatment, individual-risk inference, and substitution for licensed or local decision-makers. |
| `policyVersion` | Stable policy contract used for audit and regression testing. |

## Internal API and MCP-ready tools

The six definitions use strict JSON Schema: every property is required, nullable values use an explicit `null` type, and `additionalProperties` is false. This matches the strict function-tool requirements in the official OpenAI API documentation and the JSON Schema format returned by MCP `list_tools`.

### `resolve_place`

Resolves a ZIP input, Census ZCTA, Census place, county FIPS, state, or planning region from the stored geography catalog. It returns ambiguity and ZIP/ZCTA/county caveats rather than guessing.

### `get_place_evidence`

Returns approved observations at exactly the selected geography. It never inherits county observations into a ZCTA or Census place.

### `get_local_plan`

Returns only verified current county planning documents and explicitly cited, human-verified claims. “Not yet verified” is a valid and expected result.

### `compare_places`

Requires the same geography level, measure definition, and data period across all places. Incompatible comparisons are blocked.

### `assess_response_fit`

Returns exactly one of:

- `potentially supported`;
- `insufficient evidence`;
- `requires local partner review`;
- `not appropriate based on available evidence`.

An adverse-direction measure is not automatically treated as a priority. A potentially supported result requires both a verified local planning claim and approved context with an explicit, reviewed `adverse_signal` interpretation. It still requires local review and never claims a response will cause an outcome.

### `draft_partner_brief`

Builds a structured brief from the outputs of the evidence, local-plan, and response-fit tools. It explicitly prohibits clinical advice, individual-risk claims, causation, guaranteed outcomes, and unverified local priorities.

## Assistant safety router

`answerPlaceEvidenceQuestion` is a deterministic intent and safety layer. It routes approved questions to the six evidence tools and refuses:

- diagnosis, symptom triage, treatment, prescriptions, or medical advice;
- individual-risk inference from area measures;
- causal claims from population associations;
- live-web search;
- instructions to ignore evidence or safety rules.

No public route or user-facing assistant control was added. Public enablement requires a separate approval after the evaluation report and a production evidence-store adapter are reviewed.

## Storage and audit boundary

This milestone adds no database migration. It consumes the Milestones 1–3 contracts:

- reviewed geography catalog and relationships;
- source catalog and source versions;
- measure definitions and observations;
- planning documents, claims, and exact citations.

The in-memory repository is a reference adapter for tests and internal orchestration. A production adapter must read the same contract from the audited evidence store without changing tool behavior. The snapshot identifier is returned in evidence results so a future execution log can bind each response to the exact evidence state used.

## Public-enablement gate

The assistant must remain disabled until all of the following are approved:

1. a production `PlaceAgentRepository` backed by the audited evidence database;
2. authentication and authorization for internal tool/API access;
3. immutable execution logging for tool inputs, snapshot ID, citations, policy version, and response;
4. production evidence-quality evaluation using reviewed, publishable records rather than policy fixtures;
5. privacy, security, accessibility, and public-copy review;
6. explicit approval to expose a public assistant route and interface.

## Official design references

- OpenAI function tools: strict mode requires `additionalProperties: false` and every property marked required.
- OpenAI MCP tools: tool discovery returns a name, description, and JSON `input_schema`; private servers should use a protected connection rather than an unauthenticated public endpoint.

