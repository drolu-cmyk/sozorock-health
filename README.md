# SozoRock Health

SozoRock Health is a nationwide, AI-native access platform that helps residents in underserved and rural communities connect to licensed healthcare providers through shared tablets, personal devices, and community-based hubs.

The platform is non-clinical. It reduces access barriers—transportation, technology, language, literacy, connectivity, and wait time—while licensed providers continue to deliver care through their own approved platforms.

## What launches first

- **Resident access:** large-button and voice-enabled flows for hub check-in, language selection, provider discovery, connection requests, and session confirmation.
- **Tablet and kiosk mode:** a privacy-conscious shared-device experience for library, community, and home-based hubs, including auto-reset and offline-ready core actions.
- **Provider BYOP:** provider onboarding, state licensure verification workflow, connection configuration, and connection analytics.
- **CB-CAP:** an internal County Health Access Platform with privacy-protected national, state, county, ZIP, hub-type, language, and time filters; interactive visualizations; exports; and downloadable reports. County access is activated only after an organization expresses interest and is approved.
- **Public explainer site:** an independently deployable marketing website explaining the national hub model, BYOP, CB-CAP, AI-native access, publications, and partnership pathways.
- **AI-native experience:** voice input, text-to-speech, translation, and plain-language routing work at launch behind operational controls for availability, usage, provider choice, and incident response.

## Nationwide availability and state readiness

Anyone in the United States can search counties, discover the platform, submit interest, and begin the appropriate onboarding journey. A resident-provider connection becomes available in a state only when a participating provider's license and operational readiness for that state have been verified.

This distinction is fundamental: national discovery is open; care access is state-aware and provider-verified.

## Product foundations

The platform turns the work of two SozoRock Foundation publications into operating infrastructure:

- *Rural Equity Blueprint Series, Volume 1: Access Day* informs the multi-hub access model, readiness, health literacy, coordinated engagement, and measurable access improvement.
- *Rethinking Rural Governance, Volume 1: Delaware County, New York—from Compliance to Systems Intelligence* informs CB-CAP: accountable, proactive, anonymized county intelligence rather than fragmented and reactive reporting.

Read the product and governance translation in [docs/product-foundation.md](docs/product-foundation.md).
The narrative and approved-copy direction live in [docs/launch-story.md](docs/launch-story.md).
The governed agent and voice design is in [docs/agentic-ai-architecture.md](docs/agentic-ai-architecture.md).
The backend and automated-release requirements are in [docs/backend-and-release-contract.md](docs/backend-and-release-contract.md).

## Repository structure

```text
apps/
  mobile/          Expo app for iOS, Android, and shared tablets
  platform/        Resident, provider, county, and internal operations portal
  public-site/     Separately deployable public explainer website
packages/
  design-system/   Shared accessible components and tokens
  domain/          Shared state-readiness, consent, and analytics rules
  ai/              Provider-neutral voice, translation, and routing adapters
  config/          Feature flags and environment-safe configuration contracts
infrastructure/    Versioned deployment and environment definitions
docs/              Product, privacy, automation, and operating documentation
.github/           Required checks and deployment automation
```

## Non-negotiable product boundaries

- Collect only the resident data necessary to facilitate access, with clear consent.
- Keep resident operational data separate from CB-CAP analytics data.
- Permit only aggregated, de-identified, threshold-protected data in CB-CAP exports and visualizations.
- Do not diagnose, prescribe, store clinical notes, or represent SozoRock Health as a care provider.
- Verify provider licensure and state readiness before enabling resident connections.
- Make accessibility, language access, low-literacy design, and poor-connectivity support core requirements.

## Automation and release standard

Every change must run formatting, type, unit, accessibility, security, and build checks automatically. Protected deployment promotion requires successful checks, environment-specific configuration, migration safety checks, and an auditable release record. No manual file uploads or console-only releases are part of the target operating model.

The automation contract and deployment readiness gates are defined in [docs/automation-and-release.md](docs/automation-and-release.md).
Build-ready provider, contact, consent, privacy, and retention requirements are in [docs/operational-policy-drafts.md](docs/operational-policy-drafts.md).

## Local development

This repository is being established as a clean monorepo. Setup commands, environment contracts, and contributor instructions will be added alongside the initial application scaffolds so the documented workflow always matches the code.

## Governance

Public legal identity: **The SozoRock Foundation, Inc.**

Product, privacy, data-governance, and deployment decisions must be documented in pull requests and release records. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Status

Foundation planning and repository setup are in progress. No resident or county data should be submitted to this repository or to an unreleased environment.
