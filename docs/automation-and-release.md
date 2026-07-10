# Automation and release contract

## Goal

SozoRock Health is delivered through version-controlled, repeatable automation. Source control is the only route for application, infrastructure, schema, and configuration changes.

## Required automated checks

Every pull request and protected branch update must run:

1. dependency installation from lockfiles;
2. formatting and linting;
3. type checking;
4. unit and integration tests;
5. accessibility checks for affected web flows;
6. mobile build and core-flow tests;
7. secret scanning, dependency vulnerability scanning, and static security analysis;
8. production build validation;
9. database migration validation against a disposable environment;
10. infrastructure plan validation and policy checks.

## Deployment promotion

Promotion is automated after required checks pass:

1. a pull request deploys an isolated preview environment;
2. merging to `main` deploys the staging environment;
3. a versioned release promotion deploys production after automated smoke, privacy, and accessibility gates pass;
4. the pipeline records the source revision, migration revision, configuration revision, test results, and deployment outcome.

No production deployment relies on manual uploads, untracked console edits, or copied credentials.

## Identity and environment security

- CI uses short-lived workload identity, never long-lived deployment secrets.
- Runtime secrets are kept in managed secret storage and injected only into the services that require them.
- Local, preview, staging, and production environments remain isolated.
- Feature controls are versioned, auditable, scoped, and reversible.
- Production access is role-based and time-bounded where operationally possible.

## Release blockers

A release is blocked when any of the following is unresolved:

- a provider connection could route a resident to a provider not verified for their state;
- an export or visualization could expose a small or identifiable population;
- consent, privacy notice, or accessibility requirements fail;
- AI controls cannot be disabled quickly during an incident;
- a core resident, kiosk, provider, county, or internal-operator path fails;
- a rollback or migration recovery path has not been verified.

## Observability

Automated releases emit structured deployment events. Production monitoring must distinguish operational access events, anonymized analytics events, security events, AI usage events, and errors. Logs must avoid resident health details and other unnecessary personal data.
