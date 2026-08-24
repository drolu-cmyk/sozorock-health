# HSA publication access contract

Status: supersedes the August 19 recovery plan that made publication access independent of email delivery.

## Current rule

Health Systems Assurance and other controlled Foundation publication files use this sequence:

1. A visitor completes the required access form with valid, meaningful information and publication-access consent.
2. The server applies same-origin checks, bounded parsing, schema and data-quality validation, and overlapping rate limits.
3. The server stores a pending request and a single-use verification token. It does **not** create a publication access session at form submission.
4. The server sends the verification email through the configured Amazon SES identity. If the message cannot be sent, the request remains unverified and no download session is issued.
5. The visitor follows the verification link. The server moves the bearer token into an HttpOnly verification cookie, validates and consumes the token, marks the request verified, and atomically creates the 12-hour publication session.
6. The download route accepts only that verified session and returns a five-minute signed URL for the private S3 object.

Publication-update or marketing consent remains separate and optional.

## Security properties that must remain true

- Publication PDFs stay outside the public web root and in the private publication bucket.
- The bucket keeps public-access blocking, bucket-owner-enforced ownership, encrypted uploads, and HTTPS-only policy.
- Download URLs remain short-lived and attachment-scoped.
- Verification tokens remain random, single use, server-validated, and limited to 30 minutes.
- Publication sessions remain random, HttpOnly, Secure in production, SameSite=Lax, publication-scoped, and limited to 12 hours.
- Same-origin enforcement, request-size limits, honeypot behavior, provider-neutral email syntax validation, and network/recipient/visitor throttles remain in force.
- Consumer, education, government, nonprofit, and corporate email domains follow the same verification requirement. There is no provider allowlist.
- The form does not collect medical records, diagnoses, symptoms, insurance identifiers, or other health information.
- Publication delivery consent and optional future-update consent remain distinct.
- Raw verification tokens and session tokens are never logged.
- Publication activity and quality signals retain their existing TTL and privacy controls.

## Release gates

A public release must fail closed unless all of the following are true:

- repository typecheck, lint, tests, public build, runtime-security verification, platform build, and dependency audit pass;
- the publication CloudFormation stack and private asset bucket are healthy;
- the runtime role retains least-privilege DynamoDB, Secrets Manager, S3, and SES permissions;
- Amazon SES production access is enabled and sending is enabled, because email verification is the authorization gate;
- a synthetic production access request returns `202`, reports `verificationSent: true`, and does not issue a publication access cookie;
- a pre-verification download request is rejected;
- the verification handoff removes the token from the browser URL and places it in the protected verification cookie;
- unauthorized downloads remain rejected;
- security headers remain present.

The production smoke test cannot consume the mailbox verification link for the SES simulator recipient. The verified-session path is therefore also protected by repository tests that require `verifyAccessToken` to consume the token, mark the request verified, and create the session atomically before the download route can issue a signed private-asset URL.

## Observability

The access funnel distinguishes:

- `access_form_completed`
- `verification_sent`
- `verification_delivery_failed`
- `email_verified`
- `download_link_issued`
- `access_failed`

`verification_delivery_failed` is an access failure for that attempt because the required authorization handoff was not delivered. It must not be described as an optional-email warning.

## Definition of done

The publication contract is correct only when an unverified form submission cannot reach the private PDF, a verified single-use email token can establish the scoped session, and that session alone can reach the short-lived signed download URL.
