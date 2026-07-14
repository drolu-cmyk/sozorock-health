# SozoRock Health

SozoRock Health is a national public-interest initiative of The SozoRock Foundation, Inc. It designs and deploys non-clinical health-access, workforce-readiness, and systems infrastructure that helps people, institutions, and public agencies use existing healthcare, public-health, digital, and workforce systems more effectively.

The work spans rural and underserved health access, chronic-disease mitigation, digital navigation, AI readiness, public-sector modernization, cybersecurity readiness, and interdisciplinary workforce development.

SozoRock Health is non-clinical. Providers retain their clinical platforms and professional responsibilities.

## Product surfaces

| Surface | Purpose | Release posture |
| --- | --- | --- |
| Public site | Explain the model, present health priorities and publications, and route community, funding, volunteer, and institutional interest | Public |
| Resident app | Voice/tap readiness, language choice, hub check-in, and bounded provider-led pathways on phones and shared tablets | iOS and Android foundation |
| County-Based Community Access Platform (CB-CAP) | Nationwide geography, source-backed health and barrier patterns, planning scenarios, and CHA/CHIP workflow support | Public demonstration; stakeholder accounts later |
| Provider/BYOP | State-aware provider readiness and connection management | Gated |

National discovery is open. Resident-provider connections activate only after provider licensure and operating readiness are verified for the relevant state.

## Architecture

```text
apps/
  public-site/   Next.js public explainer and secure contact entrypoint
  platform/      Next.js CB-CAP and role-based web platform
  mobile/        Expo/React Native iOS, Android, and shared-tablet app
  media/         Remotion source for the resident journey campaign video
packages/
  domain/        Privacy suppression, metrics, filters, and export rules
infrastructure/
  amplify/       Reproducible AWS Amplify build definitions
  iam/           Least-privilege deployment and runtime policies
docs/             Product, governance, AI, privacy, and release contracts
```

The AI layer is provider-neutral and feature-controlled. `gpt-live` is the SozoRock voice capability alias; production routing selects the approved OpenAI Realtime model without coupling product code to a single model version. Human judgment, consent, provider licensure, and non-clinical boundaries remain explicit.

## Research foundation

- *Rural Equity Blueprint Series, Volume 1: Access Day* informs the Library, Community, and Home-Based Hub model, readiness, literacy, and coordinated activation.
- *Rethinking Rural Governance, Volume 1: From Compliance to Systems Intelligence* informs CB-CAP governance, proactive planning, and accountable use of aggregated data.

Both works are authored by Oluwabiyi Adeyemo. See [product foundation](docs/product-foundation.md) and [launch story](docs/launch-story.md).

CB-CAP's public data sources, calculation rules, uncertainty, scenario math, and governance boundaries are documented in the [CB-CAP data methodology](docs/cbcap-data-methodology.md).

## Requirements

- Node.js 24 or newer
- npm 10 or newer
- AWS CLI and GitHub CLI for release operations
- EAS credentials for signed iOS and Android store builds

## Local development

```bash
npm ci
npm run dev:public
npm run dev:platform
npm run start:mobile
```

Validation:

```bash
npm run typecheck
npm run lint
npm test
npm run refresh:cbcap-data
npm run build:public
npm run build:platform
npm audit --omit=dev --audit-level=moderate
npm exec --workspace @sozorock/mobile -- expo-doctor
npm exec --workspace @sozorock/mobile -- expo export --platform android
npm run audio:ambient --workspace @sozorock/media
npm run render:all --workspace @sozorock/media
npm run verify:campaign --workspace @sozorock/media
npm run voice:generate --workspace @sozorock/media
npm run render:final --workspace @sozorock/media
npm run publish:web --workspace @sozorock/media
```

The lockfile includes reviewed security resolutions for upstream packages pinned by Next.js and Expo. `patch-package` reconciles the parent manifests during installation so CI and local dependency trees remain reproducible and audit-clean.

The prerecorded bilingual campaign uses provenance-recorded Amazon Polly generative voices. The live website and mobile voice architecture remain on the OpenAI Realtime adapter. GPT-Live is an interaction-design reference until OpenAI releases and enables its developer API; current assets and sessions must not be represented as GPT-Live output. See [`docs/voice-video/VOICE-PROVIDER-DECISION.md`](docs/voice-video/VOICE-PROVIDER-DECISION.md).

## Environment contract

Public configuration:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CBCAP_URL` | Separate CB-CAP deployment URL |
| `CONTACT_SUBMISSIONS_TABLE` | Durable encrypted contact-submission store |
| `OPENAI_REALTIME_ENABLED` | Server-side live-voice kill switch. Keep unset or `false` until boundary red-team, real-device QA, and project billing pass; set exactly `true` to activate. |
| `CONTACT_NOTIFICATION_TOPIC_ARN` | Operations notification destination |
| `CONTACT_RATE_LIMIT_SALT_SECRET_ARN` | Secrets Manager salt for one-way contact rate-limit identifiers |
| `ACCESS_REQUESTS_TABLE` | Separate, encrypted non-clinical mobile access-request store |
| `ACCESS_NOTIFICATION_TOPIC_ARN` | Operations notification destination for mobile access requests |
| `ACCESS_RATE_LIMIT_SALT_SECRET_ARN` | Secrets Manager salt for one-way mobile abuse-control identifiers |
| `ACCESS_ALLOWED_ORIGINS` | Exact HTTPS origins permitted for browser preflight requests |
| `PUBLICATION_ACCESS_TABLE` | Verified publication requests, sessions, events, and rate limits |
| `PUBLICATION_ASSET_BUCKET` | Private publication-object bucket |
| `PUBLICATION_HASH_SALT_SECRET_ARN` | Secrets Manager salt for publication identifiers and tokens |
| `PUBLICATION_EMAIL_FROM` | Verified SES sender for access confirmation |

Secrets belong in environment-managed secret stores. Never commit credentials, resident information, provider verification documents, or contact-message bodies.

## Data and safety boundaries

- Minimal, consented resident data only
- The CB-CAP public demonstration uses public, aggregate or model-based geography estimates and contains no resident records
- Missing CB-CAP values remain missing; they are never converted to zero or manufactured for a complete-looking map
- Any future operational aggregates remain separate from the public-source demonstration and require approved disclosure controls before release
- No diagnosis, prescribing, clinical notes, or emergency triage
- Provider connections gated by state licensure and readiness
- Shared devices reset between sessions
- Accessibility, language access, and low-connectivity behavior are release requirements

See [CB-CAP data methodology](docs/cbcap-data-methodology.md), [operational policy drafts](docs/operational-policy-drafts.md), [agentic AI architecture](docs/agentic-ai-architecture.md), and [backend and release contract](docs/backend-and-release-contract.md).

## Automated release

GitHub Actions assumes a short-lived AWS role through OIDC. A successful release:

1. installs from the committed lockfile;
2. runs type, build, security, privacy, and mobile configuration checks;
3. provisions the contact, non-clinical mobile access, and controlled-publication AWS resources;
4. uploads approved publications to a private, public-access-blocked bucket;
5. deploys the public site and CB-CAP as separate Amplify applications;
6. waits for both AWS deployment jobs to succeed before the workflow completes.

No long-lived AWS keys or manual file uploads are required. See [automation and release](docs/automation-and-release.md).

## Governance

Public legal identity: **The SozoRock Foundation, Inc.**

Copyright © 2026 The SozoRock Foundation, Inc. All rights reserved. Contribution and security expectations are documented in [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
