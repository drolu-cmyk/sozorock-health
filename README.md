# SozoRock Health

Nationwide, AI-native access infrastructure connecting rural and underserved residents to licensed providers through trusted hubs, accessible apps, and privacy-protected county intelligence.

SozoRock Health is non-clinical. Providers retain their clinical platforms and professional responsibilities.

## Product surfaces

| Surface | Purpose | Release posture |
| --- | --- | --- |
| Public site | Explain the ecosystem, search every U.S. county, publish the research foundation, and capture partner interest | Public |
| Resident app | Voice/tap access, language choice, hub check-in, and provider pathways on phones and shared tablets | iOS and Android foundation |
| CB-CAP | Filtered, downloadable, threshold-protected county access intelligence | Public demonstration; approved county access |
| Provider/BYOP | State-aware provider readiness and connection management | Gated |

National discovery is open. Resident-provider connections activate only after provider licensure and operating readiness are verified for the relevant state.

## Architecture

```text
apps/
  public-site/   Next.js public explainer and secure contact entrypoint
  platform/      Next.js CB-CAP and role-based web platform
  mobile/        Expo/React Native iOS, Android, and shared-tablet app
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

## Requirements

- Node.js 20.11 or newer
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
npm test
npm run build:public
npm run build:platform
npm audit --omit=dev --audit-level=moderate
npm exec --workspace @sozorock/mobile -- expo-doctor
npm exec --workspace @sozorock/mobile -- expo export --platform android
```

The lockfile includes reviewed security resolutions for upstream packages pinned by Next.js and Expo. `patch-package` reconciles the parent manifests during installation so CI and local dependency trees remain reproducible and audit-clean.

## Environment contract

Public configuration:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CBCAP_URL` | Separate CB-CAP deployment URL |
| `CONTACT_SUBMISSIONS_TABLE` | Durable encrypted contact-submission store |
| `CONTACT_NOTIFICATION_TOPIC_ARN` | Operations notification destination |
| `CONTACT_RATE_LIMIT_TABLE` | Distributed rate-limit store |

Secrets belong in environment-managed secret stores. Never commit credentials, resident information, provider verification documents, or contact-message bodies.

## Data and safety boundaries

- Minimal, consented resident data only
- Operational resident data separated from CB-CAP aggregates
- CB-CAP cells below 11 observations suppressed in screens and exports
- No diagnosis, prescribing, clinical notes, or emergency triage
- Provider connections gated by state licensure and readiness
- Shared devices reset between sessions
- Accessibility, language access, and low-connectivity behavior are release requirements

See [operational policy drafts](docs/operational-policy-drafts.md), [agentic AI architecture](docs/agentic-ai-architecture.md), and [backend and release contract](docs/backend-and-release-contract.md).

## Automated release

GitHub Actions assumes a short-lived AWS role through OIDC. A successful release:

1. installs from the committed lockfile;
2. runs type, build, security, privacy, and mobile configuration checks;
3. deploys the public site and CB-CAP as separate Amplify applications;
4. waits for both AWS jobs to succeed;
5. preserves the prior production origin until live verification passes.

No long-lived AWS keys or manual file uploads are required. See [automation and release](docs/automation-and-release.md).

## Governance

Public legal identity: **The SozoRock Foundation, Inc.**

Copyright © 2026 The SozoRock Foundation, Inc. All rights reserved. Contribution and security expectations are documented in [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
