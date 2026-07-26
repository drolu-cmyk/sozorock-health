# Milestone 8 production activation

## Release status

**READY FOR PROTECTED CI. NOT YET LIVE.**

The two previous activation blockers are resolved in the release candidate:

1. GitHub access is authenticated as repository administrator `drolu-cmyk`. AWS access is authenticated to account `791860731989`, the production environment is protected, and the public Amplify target is `d2k1gmeov1v557`. The Explore-only workflow has no CB-CAP identifier or deployment action.
2. The public application now uses the supported Next.js `images.unoptimized` configuration. Clean release installs omit optional packages, so Sharp and libvips are absent from the production dependency tree and traced `.next` runtime. No canary Next.js release, unsupported override, audit suppression, or downgrade is used.

Merge and production deployment remain gated on protected CI, production-environment approval, database activation, Amplify success, and canonical-domain acceptance.

## Runtime security resolution

- Stable Next.js still records Sharp as an optional upstream dependency in source-lock metadata. The engineering record retains that fact.
- The production installation is `npm ci --omit=optional`.
- The final public runtime contains no `sharp` package, Sharp import, libvips path, or libvips binary.
- Rendered HTML does not depend on `/_next/image`.
- Existing trusted static assets are served directly; no upload, remote transformation, or untrusted image-processing service was added.
- `npm audit --omit=dev --omit=optional --audit-level=moderate` reports zero vulnerabilities.
- The CycloneDX runtime SBOM scanned by Trivy 0.72.0 reports zero high or critical vulnerabilities.
- The release build writes a file-level SHA-256 runtime manifest. The locally validated artifact contains 428 files and has hash `a13f54a4649ad24b57b39688671321ddbc22039ae4c9ef7bbc9eb43ea4cfb0a9`.
- Non-Explore rendered text, dimensions, layout, and console checks are unchanged across eight routes at desktop and mobile widths. Publication-cover codec variance is bounded to 0.3%; all other routes retain a 0.05% pixel-difference ceiling.

## Production design

- Aurora PostgreSQL Serverless v2 with PostGIS is the production authority.
- RDS Data API provides controlled server-side access without exposing a database endpoint.
- Versioned S3 objects retain immutable national source and evidence artifacts.
- PostgreSQL records source versions, approved snapshots, coverage status, capability switches, import manifests, and append-only execution audits.
- The Responses API adapter uses `store: false`, a six-tool allowlist, strict structured output, bounded tool depth and output tokens, exact-origin checks, request-size limits, per-network and daily cost controls, and fail-closed citation validation.
- The configured model is `gpt-5.6-sol`, which current OpenAI documentation lists for the Responses API.
- Narrative generation and the OpenAI provider remain disabled until deterministic production acceptance passes.
- The release workflow starts a job for the public Amplify application only. The deployment role policy is restricted to that public app.

## Evidence state

The independently rebuilt 2025 Census artifact contains 3,144 primary-scope counties and county equivalents. All are unique, searchable by name and GEOID, and produce a schema-valid `explore.place-brief.v1`. The current approved snapshot provides compatible CDC PLACES county observations where available. ACS remains `credential_blocked` because no approved Census API credential is present; HRSA remains `not_yet_verified`; AHRQ remains `awaiting_human_review`; local planning evidence remains `not_yet_verified` unless a named reviewer approves it. Missing evidence is never converted to zero.

## Completed local gates

- Clean `npm ci --omit=optional`: pass.
- Typecheck: pass.
- ESLint with zero warnings: pass.
- Repository tests: pass.
- Public production build: pass.
- Five-place desktop and mobile Explore visual suite: 10/10 pass.
- National geography and brief validation: pass for 3,144/3,144.
- Runtime SBOM and high/critical vulnerability scan: pass.
- Secret scan: pass.
- Non-Explore rendered-text and visual regression: pass for eight routes at desktop and mobile widths.
- GitHub workflow static validation with actionlint 1.7.12: pass.
- Disposable PostGIS migration apply, rollback, and reapply: pass locally and remains a protected CI gate.

## Deployment identity and rollback

Amplify automatic builds are disabled. The workflow verifies that `origin/main` equals the approved release SHA immediately before and after starting the manual `RELEASE` job, records Amplify's reported commit identifier, and waits for `SUCCEED`.

Before a production migration, the workflow creates a manual Aurora cluster snapshot. The previous successful public Amplify job and the prior approved evidence snapshot remain independent rollback points. A failed canonical-domain acceptance disables narrative capability, retries the previous public Amplify job, restores the prior evidence authority, and preserves immutable audit history. CB-CAP is never included in this workflow.
