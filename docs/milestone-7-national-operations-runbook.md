# Milestone 7 national operations runbook

Status: internal operating procedure. No public release is authorized by this document.

## Operating roles

| Role | Responsibility |
|---|---|
| Data operator | Runs source checks, validates schema and geography, reviews failures, and records import status. |
| Evidence reviewer | Verifies local documents, claims, citations, scope, dates, and current-plan status. |
| Product owner | Approves public wording, response concepts, and release scope. |
| Security and privacy reviewer | Reviews access, secrets, logs, retention, abuse controls, and incidents. |
| Release operator | Runs the acceptance suite, records hashes, deploys only after approval, and owns rollback. |

One person may hold more than one role, but no person may both propose and approve a local-plan claim in the same review action.

## Source refresh schedule

| Source | Check cadence | Freshness rule | Release behavior |
|---|---|---|---|
| CDC PLACES | Weekly metadata check; import on official release change | Stale after 400 days unless official notes establish a different release cycle | Validate measure definitions, geography coverage, release date, data period, and missing-state notes before promotion. |
| ACS five-year | Monthly release check; import the newest reviewed annual vintage | Stale after 430 days | Require the configured Census API key, variable-contract validation, margins of error, and exact geography. |
| HRSA shortage areas | Daily | Stale after 3 days | Preserve designation type and scope. Whole-county absence cannot be described as absence of every subcounty, population-group, or facility designation. |
| AHRQ Community-Level Health | Monthly release check | Stale after 430 days | Import only with an approved artifact reader, codebook, terms review, and variable contract. |
| Census geography | Annual vintage review plus release-triggered corrections | Use one named vintage per release | Validate FIPS, boundaries, place relationships, and ZIP/ZCTA caveats before publication. |

Each import is idempotent by source version and content hash. Store the source URL, release date, data period, retrieval time, record counts, rejected records, cache disposition, warnings, failure code, and success time. Never overwrite a prior source version.

## Source outage and retry procedure

1. Make at most three bounded attempts for timeout, HTTP 429, or upstream 5xx responses.
2. Respect official retry guidance when available; otherwise use exponential delay with a capped total job time.
3. Use conditional requests with ETag or Last-Modified where supported.
4. If a reviewed cached version remains within its freshness window, serve it with its original dates.
5. If the cached version is stale, label it stale and do not use it for a new public conclusion.
6. If no reviewed version exists, show “source unavailable.” Do not substitute zero or an unrelated geography.
7. Alert the data operator after one failed scheduled run; escalate to the product owner after two consecutive runs or before any public claim would become stale.

## Cost and abuse controls

- Set a maximum request count, bytes downloaded, records processed, concurrency, and elapsed time for every source job.
- Cache official source responses and map boundaries using source-aware keys.
- Rate-limit public search, evidence, map, download, and assistant endpoints separately.
- Cap request and response payloads and reject unbounded geography or measure lists.
- Keep the public assistant disabled until daily and monthly token budgets, per-request limits, usage alarms, and a fail-closed cutoff are configured.
- Record cost by source job, public route, and assistant tool. A budget breach pauses new work; it never weakens evidence checks.

## Monthly CHA/CHIP discovery check

1. Review approved state clearinghouses, county or local health departments, regional planning collaboratives, and hospital CHNA/CSP pages.
2. Record candidates with publisher, covered geography, scope, document type, publication date precision, plan cycle, official URL, retrieval date, content hash, and candidate confidence.
3. Reject or quarantine sources outside the approved families.
4. Extract proposed priorities, disparities, objectives, interventions, partners, target populations, assets, and evaluation measures only when explicitly stated.
5. Retain exact page or section citations and the source text used.
6. Send ambiguous geography, scope, cycle, citation, or extraction to the human-review queue.
7. Never call an unverified candidate a county’s current plan.

## Human verification queue

- Blocking reasons include unapproved source, ambiguous geography or scope, missing plan cycle, missing citation locator, citation mismatch, non-explicit claim, low confidence, and current-plan verification.
- A reviewer must record identity, time, decision, and rationale.
- Approval verifies the specific candidate, claim, citation, or designation; it does not approve unrelated content.
- Rejected and superseded records remain in the audit trail.
- Public snapshots include only eligible verified records. Provisional material remains internal.

## Source correction procedure

1. Open a correction record with the public URL, claim or metric ID, reported issue, reporter, and time.
2. Freeze new exports that depend on the disputed evidence.
3. Compare the retained source artifact, source version, parser output, and public representation.
4. If the source changed, ingest a new version; do not edit history.
5. If SozoRock transformed the source incorrectly, mark the affected record rejected, publish a corrected reviewed version, and link the audit events.
6. Notify affected internal reviewers and record whether a public correction notice is required.

## Content correction or removal

- Remove a public claim immediately when it is unsafe, wrongly scoped, uncited, unverified, legally restricted, or materially misleading.
- A takedown must preserve an internal audit event, reason, actor, before hash, and after hash.
- Replace the public content with a plain status such as “under review” or “not yet verified.”
- Never silently rewrite a cited historical claim.

## Public-data disclaimer policy

Every place brief must explain that public measures may be modeled, delayed, suppressed, or unavailable; that ZIP and ZCTA are different; that local plans and national datasets serve different purposes; and that the information is non-clinical. A disclaimer cannot cure an inaccurate claim or incompatible geographic join.

## Agent evaluation cadence

- Run deterministic tool and adversarial tests on every change to evidence, agent policy, tool schema, or response generation.
- Run the five-place evaluation weekly and before every release candidate.
- Perform a monthly human review of sampled answers across verified, provisional, stale, missing, and geography-mismatch cases.
- Repeat the full safety evaluation after any model, prompt, retrieval, citation, or repository change.
- Block release on medical advice, unsupported causation, missing citations, hidden geography substitution, favorable-as-adverse ranking, or unverified-plan presentation.

## Monitoring and alerting

Monitor source run status, consecutive failures, data age, rejected-record rate, cache fallback, public error rate, latency, payload size, map failures, rate-limit events, agent refusals, missing citations, review-queue age, and correction incidents. Alerts must identify source version, geography, job or request ID, and affected public snapshot without logging health or medical information.

## Wrong or stale public claim incident

1. Acknowledge within one hour and assign an incident owner.
2. Disable the affected claim, geography, export, or assistant tool through a feature flag or snapshot rollback.
3. Preserve logs and hashes; do not expose personal or secret data in the incident channel.
4. Determine whether the fault is source, ingestion, geography, review, generation, cache, or deployment.
5. Correct or remove the content, purge affected caches, and verify the public response.
6. Notify partners when a downloaded brief was materially affected.
7. Record root cause, impact, timeline, corrective action, and prevention before restoring the feature.

## Release procedure

1. Freeze source versions and record hashes for the candidate.
2. Close all blocking review tasks for public claims.
3. Run unit, integration, agent, five-place, accessibility, viewport, map, performance, security, dependency, and link checks.
4. Confirm public routes consume the reviewed evidence snapshot rather than uncontrolled live evidence.
5. Confirm rate, cost, monitoring, privacy, retention, and incident controls.
6. Present pass/fail results, unresolved issues, data limitations, release recommendation, and rollback plan to the product owner.
7. Deploy only after explicit approval.

## Rollback plan

- Retain the last approved application artifact, evidence snapshot, source manifest, boundary manifest, and configuration version.
- Roll application and evidence snapshots independently.
- Disable assistant, exports, individual sources, map layers, or affected geographies through separate flags.
- Purge caches after rollback and verify five evaluation places plus the reported incident geography.
- Do not roll back audit records; append a rollback event with actor, reason, and hashes.
