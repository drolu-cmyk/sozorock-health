# Automation and release contract

## Goal

SozoRock Health is delivered through version-controlled, repeatable automation. Source control is the only route for application, infrastructure, schema, and configuration changes.

## Required automated checks

The `Verify` workflow runs for every pull request and every update to `main`. It currently enforces:

1. dependency installation from lockfiles;
2. linting;
3. type checking;
4. repository unit and integration tests;
5. a guard that rejects publication PDFs beneath the public web root;
6. production builds for the public site and CB-CAP;
7. Expo Doctor plus iOS and Android static exports; and
8. a production-dependency vulnerability audit at the configured severity threshold.

The separate `CodeQL` workflow performs JavaScript and TypeScript static analysis on pull requests, updates to `main`, and a weekly schedule. Dependabot reviews npm and GitHub Actions dependencies on the configured schedule. Browser accessibility, visual, privacy, and live-path verification remain human-reviewed release evidence; they are not represented as automated CI gates until a workflow actually enforces them.

## Production deployment

Production deployment is deliberate and automated:

1. the `Deploy` workflow can be started manually and always checks out `main`;
2. the GitHub `production` environment supplies the approval policy and protected configuration;
3. the workflow reruns source, test, build, and dependency-audit checks;
4. GitHub assumes the deployment role through OpenID Connect;
5. CloudFormation updates the scoped contact, access-request, voice, and controlled-publication resources;
6. approved publication PDFs are synchronized to the private publication bucket; and
7. the workflow starts both Amplify release jobs and fails unless both report success.

The workflow does not currently create pull-request previews or a separate staging promotion, and it does not claim an automatic rollback. Live browser, form, publication-access, and CB-CAP smoke checks must follow deployment; the previous release remains the rollback source if a live gate fails.

No application or infrastructure release relies on manual file uploads, untracked console edits, or copied cloud credentials. Mobile-store delivery uses its own manually triggered, credential-gated workflow because Apple and Google signing and review are separate release authorities.

## Identity and environment security

- CI uses short-lived workload identity, never long-lived deployment secrets.
- Runtime secrets are kept in managed secret storage and injected only into the services that require them.
- Local development and production credentials remain isolated. Preview or staging environments must not be described as release controls until they are provisioned and automated.
- Feature controls are versioned, auditable, scoped, and reversible.
- Production access is role-based and time-bounded where operationally possible.

## Release blockers

A production release is blocked when any of the following is unresolved:

- a provider connection could route a resident to a provider not verified for their state;
- an export or visualization could expose a small or identifiable population;
- consent, privacy notice, or accessibility requirements fail;
- AI controls cannot be disabled quickly during an incident;
- a core path included in the release fails its applicable automated or browser check;
- the source revision cannot be identified or the prior releasable revision cannot be recovered.

## Observability

GitHub Actions, CloudFormation, Amplify, and CloudWatch retain deployment and service evidence within their configured retention periods. Production monitoring must distinguish operational access events, de-identified analytics events, security events, AI usage events, and errors. Logs must avoid resident health details and other unnecessary personal data.
