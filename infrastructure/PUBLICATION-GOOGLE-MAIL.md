# Google Workspace publication delivery

The Foundation publication flow uses the existing Health publication API, pending email verification, short-lived tokens and private S3 files. This change does not redesign Health or Place Intelligence.

## Configuration

- Provider: PUBLICATION_EMAIL_PROVIDER=google.
- Sender: contact@sozorockfoundation.org, matching the authenticated mailbox and SMTP envelope.
- Parameter name: PUBLICATION_GOOGLE_MAIL_PARAMETER=/sozorock-foundation/publication-google-mail.
- Storage: Standard SSM SecureString, account 791860731989, us-east-1, AWS-managed SSM encryption key. The encrypted JSON contains user and pass. Never put that JSON in GitHub variables, Amplify build variables, local files, logs or browser assets.
- SMTP: smtp.gmail.com:587 with mandatory STARTTLS, TLS 1.2 minimum and certificate validation. No authentication before TLS; no plaintext fallback. Local port 465 certificate validation failed, while port 587 validated successfully.
- Runtime credentials refresh after five minutes or a send failure. Errors are redacted. File/URL attachment access and transport debug logs are disabled.

The existing SES adapter remains explicitly selectable for rollback only. Google errors do not fall back silently to SES. The Google deployment gate authenticates the configured sender and verifies the runtime role can read the exact parameter. SMTP authentication does not itself prove inbox placement.

## Authority and source of truth

Google Account controls the mailbox credential and two-step verification. SSM holds the encrypted application credential. infrastructure/cloudformation/publication-access.yml owns runtime IAM. infrastructure/iam/publication-google-mail-read.json documents the exact read permission attached to GitHubOIDC_SozoRockHealthV2_DeployRole as SozoRockFoundationPublicationGoogleMail. The bootstrap policy also preserves this permission on future reconciliation.

The production GitHub environment selects the provider and parameter name. infrastructure/amplify/public-site.yml includes only those non-secret identifiers in server runtime configuration. The existing d2k1gmeov1v557 Amplify app and main branch remain the deployment target.

## Verification and recovery

Local authentication succeeded on September 7, 2026. The credential was created for Foundation publications and saved as parameter version 1 without logging its value. Full delivery acceptance requires a production request, receipt of the verification message, authentication-header inspection, token consumption and private PDF download. Keep marketing consent separate and unchecked by default.

For rotation, create a replacement Google app password using the mailbox owner's verified session, verify it, overwrite the same encrypted parameter, then revoke the old Google credential. Never record either value in release notes. A changed Google account password may revoke app passwords. If mail fails, preserve pending access and return a useful retryable error; never grant downloads just because the form was submitted.

SPF, DKIM and DMARC are separate DNS and message-authentication controls. Website releases must not overwrite Google Workspace DNS records. Monitor actual alignment before strengthening domain-wide DMARC enforcement.
