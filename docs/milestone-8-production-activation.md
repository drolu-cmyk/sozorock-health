# Milestone 8 production activation

## Release status

**NO-GO. Do not merge or deploy.**

The implementation branch contains the production authority, guarded agent API, national import path, and Explore-only release workflow. Production remains unchanged because two release blockers are unresolved:

1. The latest stable Next.js releases still declare Sharp 0.34.x. Sharp 0.35.3 and libvips 8.18.3 install and build successfully through npm overrides, and `npm audit --omit=dev` reports zero vulnerabilities, but `npm ls sharp --all` correctly rejects the graph because stable Next.js does not yet support the 0.35 range. Official 0.35.3 support is present only in a Next.js canary release. The protected workflow intentionally fails this gate.
2. The repository’s current GitHub OIDC deploy policy does not contain the RDS, EC2, S3 evidence-bucket, monitoring, and runtime-policy permissions required by the production Evidence Core stack. The least-privilege policy update is committed for infrastructure approval; the live role cannot be re-verified from this credential-free workstation, and no production database or stack was created.

## Production design

- Aurora PostgreSQL Serverless v2 with PostGIS is the production authority.
- RDS Data API provides controlled server-side access without exposing a database endpoint.
- Versioned S3 objects retain immutable national source and evidence artifacts.
- PostgreSQL records source versions, approved snapshots, coverage status, capability switches, import manifests, and append-only execution audits.
- The Responses API adapter uses `store: false`, a six-tool allowlist, strict structured output, bounded tool depth and output tokens, exact-origin checks, request-size limits, per-network and daily cost controls, and fail-closed citation validation.
- Narrative generation and the OpenAI provider remain disabled until deterministic production acceptance passes.
- The release workflow starts a job for the public Amplify application only. It contains no CB-CAP application identifier or deployment action.

## Evidence state

The independently rebuilt 2025 Census artifact contains 3,144 primary-scope counties and county equivalents. All are unique, searchable by name and GEOID, and produce a schema-valid `explore.place-brief.v1`. The current approved snapshot provides compatible CDC PLACES county observations where available. ACS remains `credential_blocked`; HRSA remains `not_yet_verified`; AHRQ remains `awaiting_human_review`; local planning evidence remains `not_yet_verified` unless a named reviewer approves it. Missing evidence is never converted to zero.

## Completed local gates

- Clean `npm ci`: pass.
- Typecheck: pass.
- Lint: pass.
- Repository tests: pass.
- Public production build: pass.
- Five-place desktop and mobile Explore visual suite: 10/10 pass.
- National geography and brief validation: pass for 3,144/3,144.
- `npm audit --omit=dev --audit-level=moderate`: pass with zero vulnerabilities.
- Installed runtime: Sharp 0.35.3, libvips 8.18.3.
- Supported dependency-range gate: fail; stable Next.js declares Sharp 0.34.x.
- Disposable PostGIS migration workflow: prepared, but local Docker was unavailable; it must pass protected CI before release.

## Rollback boundary

Before a production migration, the workflow creates a manual Aurora cluster snapshot. The previous successful public Amplify job and the prior approved evidence snapshot remain independent rollback points. A failed canonical-domain acceptance disables narrative capability, restores the public application, and preserves immutable audit history. CB-CAP is never included in this workflow.
