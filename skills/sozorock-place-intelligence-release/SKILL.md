---
name: sozorock-place-intelligence-release
description: Operate the SozoRock Health Explore and Place Intelligence release safely from audit through production verification. Use for nationwide Evidence Core changes, source refreshes, grounded agent work, county collaboration, security gates, protected GitHub release, Explore-only AWS deployment, or release resumption after an authority interruption.
---

# SozoRock Place Intelligence Release

Use this procedure for the Explore-only product. Preserve the homepage, non-Explore routes, branding, mobile app, publications, contact flow, CB-CAP application, and their deployment paths.

## 1. Establish the real baseline

Run from the repository root and record the outputs before editing:

```powershell
git status --short
git branch --show-current
git log -1 --oneline
git remote -v
git ls-remote origin
gh auth status
gh api user
aws sts get-caller-identity
```

Confirm the branch, origin, production commit, public Amplify application, custom-domain route, and the exact artifact currently serving production. If a connector reports `pull:true, push:false` or AWS has no caller identity, treat that as a real authority blocker. Do not request tokens, passwords, MFA codes, or secrets in chat; reconnect the approved write-capable GitHub account and AWS role instead.

Fetch the current remote refs before comparing ancestry. Never force-push or rewrite milestone history. Create one integration branch from the verified release commit and keep the working tree clean between commits.

## 2. Preserve product contracts

Read the applicable contracts before changing code:

- `docs/explore/milestone-10-agentic-collaboration.md`
- `docs/explore/yc-fall-2026-evidence.md`
- `docs/explore/fall-2026-release.md`
- `docs/explore/operations-metrics.md`
- `docs/explore/entity-ip-readiness.md`

The canonical evidence geography is a Census county or county equivalent. ZIP Codes, ZCTAs, and cities are inputs only. Preserve overlap disclosures and never inherit county evidence into a ZIP, city, neighborhood, or hotspot. Keep verified local planning evidence separate from modeled national measures. Missing is not zero.

The public response contract remains Brief / Map / Action / Visuals. Every claim needs source, publisher, URL, release/publication date, data period, geography, measure or passage, confidence, uncertainty where supplied, and limitations. The agent is non-clinical, source-grounded, has no live web search, and fails closed when evidence is insufficient.

## 3. Implement the Evidence Core safely

Use PostgreSQL/PostGIS as the production authority and immutable S3 source artifacts. Keep source adapters versioned and idempotent for Census geography, CDC PLACES, ACS, HRSA HPSA/MUA-P/AHRF, AHRQ CLH, and approved local planning documents. Record source version, release date, data period, retrieval time, checksum, geography level, directionality, uncertainty, freshness, and audit state.

Local planning documents must be discovered only from approved official source families. Preserve exact document/page/section citations. Keep unverified, stale, unavailable, rejected, credential-blocked, incompatible, and awaiting-review states explicit. A failed refresh leaves the last approved snapshot active.

For the collaboration layer, enforce Cognito identity, tenant scope, workspace membership, server-side authorization, append-only events, event sequence numbers, idempotency keys, optimistic concurrency, opaque expiring share/invitation/handoff tokens, and viewer write protection. Human acceptance is required for agent suggestions. Scenarios are ranges with visible assumptions, formula, model version, missing inputs, evidence, and review status; never present them as predictions or calculate reach without defensible inputs.

## 4. Security and runtime gates

Run from a clean install. Next image optimization must not reintroduce Sharp/libvips into the deployed runtime. If `images.unoptimized` is used, preserve dimensions, crop, alt text, and visible rendering. Prove the final artifact contains neither `sharp` nor vulnerable libvips binaries; do not suppress advisories, override unsupported dependencies, or delete packages after installation.

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build:public
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd run verify:public-runtime-security
npm.cmd run test:explore-visual --workspace @sozorock/public-site -- --grep "one stratified county"
git diff --check
```

Also run the Evidence Core, public-site, Explore browser, accessibility, map fallback, migration, source-coverage, security, and agent adversarial suites required by the current milestone. Record the runtime artifact checksum, SBOM, vulnerability result, and test counts in the release evidence.

## 5. Verify agent and operations behavior

Exercise the read-only tools only: `resolve_place`, `get_place_evidence`, `get_local_plan`, `compare_places`, `assess_response_fit`, and `draft_partner_brief`. Validate geography compatibility, source approval, freshness, directionality, benchmarks, uncertainty, citations, local-plan status, non-clinical classification, authorization, snapshot consistency, rate limits, timeout, token/cost budget, and audit writes. Clinical requests, individual-risk inference, unsupported interventions, live-web requests, and uncited claims must fail closed.

For operations, verify source-health status, retry/backoff, schema-drift detection, last-approved-snapshot fallback, immutable import/execution/audit records, retention, correction workflow, monitoring, rollback switches, and the separation of production traction from staging/test usage. Do not describe a demo, review request, or onboarding submission as a customer, pilot, outcome, or traction claim.

The YC demo package must be factual and separately versioned from the approved 80-second bilingual campaign. Do not call prerecorded Amazon Polly output GPT-Live, and do not call an illustrative campaign a verified product or traction demo. A verified demo needs dated approval, a reproducible build artifact, source/asset manifest, captions/transcript, and a review record.

## 6. Protected release and live verification

Push only the intended Explore branch with a clean worktree. Open a ready-for-review PR with the exact commit, changed scope, security evidence, national coverage, data limitations, agent controls, migration plan, deployment plan, and rollback plan. Wait for required CI, CodeQL, accessibility, dependency, and production-build checks; never weaken a gate.

Deploy only the Explore/public-site artifact and its required APIs. Do not run a workflow that also deploys CB-CAP. Apply production migrations only through the protected AWS role after backup and rollback checks. Keep the previous approved evidence snapshot available.

After the deployment reports success, verify the canonical domain, not only an Amplify URL:

- homepage and every non-Explore route are unchanged;
- `/explore` and the versioned brief API return expected responses;
- all 3,144 current 50-state-plus-DC counties resolve and validate;
- Albany, Schenectady, Montgomery, Chester, Bexar, and a stratified county from every state/DC pass;
- ZIP/city overlap, citations, data periods, source statuses, map/table equivalence, agent refusal, rate limits, monitoring, and audit writes work;
- 320, 375, 390, 414, 768, 1024, and 1440 widths have no overflow or console errors;
- the runtime artifact still contains no Sharp/libvips.

If any critical check fails, disable the affected capability, restore the previous evidence snapshot, roll back only the Explore/public-site deployment, purge affected caches, preserve audit history, and verify the previous production job. Never roll back or redeploy CB-CAP as part of this procedure.

## 7. Handoff record

End every run with a concise release matrix containing baseline, branch, commit, PR/merge, workflow and Amplify identifiers, migration version, evidence snapshot, source coverage, agent status, accessibility/performance/security results, remaining evidence gaps, rollback identifier, and an explicit statement that CB-CAP and non-Explore design were unchanged. If authority is missing, report the exact verified permission error and the single reconnection needed; do not claim push, merge, deployment, or live success.
