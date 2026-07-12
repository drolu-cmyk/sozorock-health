# Operational launch policies

Status: approved by Oluwabiyi Adeyemo for the July 2026 public web launch. These are operating controls, not legal advice. Provider routing, county-user access, native live voice, and mobile-store submission remain fail-closed until their additional verification, credential, device, and professional-review gates are complete.

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
- prevent automated abuse with exact-origin checks, server-side rate limits, a hidden honeypot, and bounded request bodies; a managed human-verification challenge may be added if observed abuse warrants it;
- validate and normalize input on the server; avoid rendering untrusted data; and suppress sensitive content from logs;
- encrypt data in transit and at rest; send notification to `contact@sozorockfoundation.org`; and store an auditable submission record;
- support configurable retention, deletion, access, and consent-withdrawal workflows.

## Privacy notice and consent

The resident, provider, county, and public-contact experiences require separately scoped notices. Each must identify the data purpose, minimum data collected, sharing boundary, security measures, rights and contact route, retention rule, and the fact that SozoRock Health is non-clinical.

The launch build makes notice versions and consent records explicit and auditable. The designated data-governance owner approved the published web notice and current retention schedule for launch. Qualified legal review remains recommended and is required before expanding collection, enabling provider routing, launching in a jurisdiction with additional requirements, or changing the non-clinical boundary.

## CB-CAP retention and disclosure control

- Resident operational records and CB-CAP data are physically and logically separated.
- The public CB-CAP release uses synthetic demonstration data only. A future data pipeline may receive only approved aggregated, de-identified events after governance review.
- All dashboards, filters, exports, and downloads apply a minimum-cell threshold and suppression logic before results leave the service.
- Downloadable reports include generation time, filter context, data-version context, privacy notice, and suppression status.
- Retention values remain centrally configurable and cannot be made permanent by client-side code.
