# Fall 2026 application evidence pack

## What can be verified from this release

- A versioned nationwide county evidence contract and official-source ingestion tests are present in `packages/evidence-core`.
- The public Explore surface has Brief, Map, Action and Visuals views and preserves county-first geography disclosures.
- The Place Agent route is evidence-only, source-cited, non-clinical and rate-limited by contract and tests.
- Authenticated county workspaces have tenant-scoped authorization, append-only event history, optimistic concurrency, scoped sharing, handoffs and versioned forks.
- Source maintenance produces guarded review proposals rather than silently publishing changed mappings.
- Pilot onboarding accepts a bounded non-clinical request with consent and explicitly separates test/staging activity from production measurement.

## What is not claimed

- No paid customer, signed county, provider adoption, funder commitment, retention rate, clinical outcome or production pilot result is claimed by this repository.
- Test fixtures, staging users and automated release checks are not users or traction.
- Public data and modeled estimates do not prove a local intervention need by themselves.

## Evidence links

- Repository: `https://github.com/drolu-cmyk/sozorock-health`
- Public Explore: `https://health.sozorockfoundation.org/explore`
- Contracts and tests: `packages/evidence-core/src`, `packages/evidence-core/tests`, `apps/public-site/tests`
- Release operations: `.github/workflows/explore-production.yml`, `.github/workflows/source-adapter-proposals.yml`

The owner should attach dated production deployment records, reviewer approvals and any partner letters separately before submitting an external application.
