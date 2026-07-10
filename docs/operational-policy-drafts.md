# Operational policy drafts requiring approval

These are build-ready policy requirements, not legal advice or final legal notices. They require review and formal approval before production launch.

## Provider verification policy

### Required before a provider can receive connection requests

1. Verified organization and authorized administrator.
2. Verified individual clinician identity and professional license through the applicable state licensing authority or an approved credential-verification process.
3. Recorded state or states of practice, license status, expiration, and re-verification date.
4. Confirmed provider connection method, availability model, escalation contact, and non-clinical platform agreement.
5. Internal approval and an auditable state-readiness status.

### Operating safeguards

- A provider cannot be matched outside their verified state scope.
- Expired, suspended, unverified, or temporarily paused status immediately removes routing eligibility.
- The platform stores only the minimum verification evidence and metadata necessary for governance and audit.
- Re-verification cadence, exception handling, and incident escalation are configuration-driven and must be approved before launch.

## Contact and partnership inquiries

The public contact form is the default entry route. It will:

- collect only name, organization, email, role, state/county, inquiry type, and a bounded message;
- require an affirmative privacy acknowledgement before submission;
- prevent automated abuse with server-side rate limits, a hidden honeypot, signed submission tokens, and a managed human-verification challenge;
- validate and normalize input on the server; avoid rendering untrusted data; and suppress sensitive content from logs;
- encrypt data in transit and at rest; send notification to `contact@sozorockfoundation.org`; and store an auditable submission record;
- support configurable retention, deletion, access, and consent-withdrawal workflows.

## Privacy notice and consent

The resident, provider, county, and public-contact experiences require separately scoped notices. Each must identify the data purpose, minimum data collected, sharing boundary, security measures, rights and contact route, retention rule, and the fact that SozoRock Health is non-clinical.

The launch build will make notice versions and consent records explicit and auditable. The final notice text, jurisdiction-specific requirements, age policy, retention schedule, and any health-data obligations must be approved by qualified counsel and the designated data-governance owner before production collection begins.

## CB-CAP retention and disclosure control

- Resident operational events and CB-CAP analytics events are physically and logically separated.
- CB-CAP receives only aggregated, de-identified events.
- All dashboards, filters, exports, and downloads apply a minimum-cell threshold and suppression logic before results leave the service.
- Downloadable reports include generation time, filter context, data-version context, privacy notice, and suppression status.
- Retention values remain centrally configurable and cannot be made permanent by client-side code.
