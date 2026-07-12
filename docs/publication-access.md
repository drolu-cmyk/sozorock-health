# Publication access

The publication workflow separates public summaries from controlled PDF delivery.

## Visitor journey

1. A visitor opens a public publication summary.
2. The visitor requests access and gives delivery consent. Publication-update consent is separate and optional.
3. The server validates the request, applies a per-email-and-network rate limit, and emails a single-use verification link.
4. Verification creates a 12-hour, HTTP-only access session.
5. A download request receives a five-minute S3 presigned URL. The source bucket remains private. Issuing that link is recorded; the application does not claim that the file was downloaded successfully.

The form must not collect medical records, diagnoses, symptoms, insurance identifiers, or other health information.

## Data and retention

- Access requests and consent records expire after 180 days through DynamoDB TTL.
- Verification tokens expire after 30 minutes and are single-use.
- Access sessions expire after 12 hours.
- Rate-limit records expire after two hours.
- Event records expire after 180 days.
- Email and network identifiers used for controls are salted one-way hashes where the clear value is not operationally required.

## Events

`publication_viewed`, `access_started`, `access_form_completed`, `verification_sent`, `email_verified`, `publication_opened`, `download_link_issued`, and `access_failed` are stored without health information.

`download_link_issued` means the server authenticated the session and returned a short-lived signed link. It is not a completed-download metric. Any future KPI for confirmed delivery must be backed by private S3 or CloudFront delivery telemetry with an approved retention and access policy.

## Release prerequisites

- Deploy `infrastructure/cloudformation/publication-access.yml` with an existing verified SES identity.
- Put the approved PDFs in the generated private S3 bucket using the keys defined in `app/lib/publications.ts`.
- Remove the matching PDFs from `apps/public-site/public/publications` before production release.
- Provide the CloudFormation output values to the server runtime, including the salt secret ARN as `PUBLICATION_HASH_SALT_SECRET_ARN`. The server resolves the secret at runtime; never expose its value through `next.config.ts` or a `NEXT_PUBLIC_` variable.
- Verify SES production access and delivery for the `sozorockfoundation.org` domain.
- Confirm the 180-day access-record retention rule in the final privacy notice before production release.
