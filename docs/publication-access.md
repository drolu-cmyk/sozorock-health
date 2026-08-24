# Publication access

The publication workflow separates public summaries from controlled PDF delivery. Email verification is the authorization gate for the private publication file; optional publication updates remain a separate consent choice.

## Visitor journey

1. A visitor opens a public publication summary. First-party source/referral context is retained for the publication journey so campaign information is not lost when the visitor moves to the access page.
2. The visitor requests access and gives publication-access consent. Publication-update consent is separate and optional.
3. The server validates the request, rejects obvious placeholder or gibberish input, validates the country and administrative area, applies hourly and daily abuse limits, stores a pending request, creates a single-use verification token, and sends the verification email. No publication access session exists at this stage.
4. The visitor follows the verification link. The server validates and consumes the one-time token and atomically creates a 12-hour HTTP-only publication access session scoped to that publication.
5. A verified download request receives a five-minute S3 presigned URL. The source bucket remains private. Issuing that link is recorded; the application does not claim that the file was downloaded successfully.

If the verification message cannot be sent, the request does not become an authorized publication session. The visitor receives a service error and can try again later. The form must not collect medical records, diagnoses, symptoms, insurance identifiers, or other health information.

## Data quality and identity confidence

A public form cannot prove a person's legal identity, employer, or affiliation. The system records evidence and confidence rather than treating every submitted field as verified fact.

- Names, organizations, localities, and reasons for interest reject obvious placeholders, repeated-character strings, and low-information input.
- Reserved or fake email domains are rejected. Consumer, organizational, and known disposable email domains are classified for quality review; consumer email addresses remain valid publication-access addresses.
- Email verification proves mailbox control only. It does not prove the person's declared employer, location, or legal identity.
- Each request receives a quality score and `high`, `medium`, or `low` band with explicit flags such as `email_unverified`, `email_verified`, `consumer_email`, `disposable_email`, `rapid_submission`, `automation_suspected`, and declared/network country mismatch.
- Location mismatch is a review signal, not an automatic rejection, because travel, VPNs, mobile networks, and remote work can legitimately create differences.

## Location model

- Country is selected from a global ISO 3166 country list.
- Countries with a maintained structured administrative-area list use controlled state, province, or territory choices.
- Other countries require a meaningful state, province, region, county, department, or equivalent administrative area rather than defaulting to a US-only model.
- The server revalidates both the country and administrative area; client-side choices are not trusted by themselves.

## Attribution and technical context

Publication access records can include first-party attribution and coarse technical context needed to understand reach:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`;
- first external referring host and landing path;
- random first-party visitor identifier stored in the browser and persisted only as a salted one-way identifier on the server;
- device class, operating-system family, browser family, language, and time zone;
- coarse network country or region when the hosting layer supplies those values.

The application does not store the raw network address with the publication request. Rate limits and durable network correlation use salted one-way identifiers.

## Abuse controls

The public access endpoint combines overlapping controls rather than relying on one IP limit:

- per network + email: 4 requests/hour;
- per network: 20 requests/hour and 80/day;
- per recipient email: 8/hour and 12/day;
- per first-party visitor identifier: 12/day;
- separate verification and event throttles;
- same-origin enforcement, bounded request bodies, structured validation, and a honeypot field.

Shared networks remain usable because no single network-level limit is the only decision signal. Obvious malformed or gibberish records fail validation. Plausible requests still must complete mailbox verification before a publication session is issued.

## Data and retention

- Access requests, consent records, attribution context, and quality indicators expire after 180 days through DynamoDB TTL.
- Verification tokens expire after 30 minutes and are single-use.
- Verified access sessions expire after 12 hours.
- Hourly rate-limit records expire after two hours; daily rate-limit records expire after two days.
- Event records expire after 180 days.
- Email, visitor, and network identifiers used for controls are salted one-way hashes where the clear value is not operationally required.

## Events

`publication_viewed`, `access_started`, `access_form_completed`, `verification_sent`, `verification_delivery_failed`, `email_verified`, `publication_opened`, `download_link_issued`, and `access_failed` are stored without health information.

Browser-originated funnel events carry the same first-touch source/referral and coarse device context so summary-page views, access starts, completed requests, verified requests, and issued download links can be compared by source and medium.

`verification_delivery_failed` means the required mailbox-verification message could not be sent. The request remains unverified and no publication session is issued.

`download_link_issued` means the server authenticated a verified session and returned a short-lived signed link. It is not a completed-download metric. Any future KPI for confirmed delivery must be backed by private S3 or CloudFront delivery telemetry with an approved retention and access policy.

## Internal intelligence

The DynamoDB table has a `PublicationIntelligence` index for publication-specific request and event queries. The reporting service aggregates requests, verification, quality, country or region, sector, source, medium, campaign, device or browser, email-domain category, and funnel events. Individual access-request records are available only through the authenticated publication-intelligence API.

`GET /api/publications/intelligence/{slug}` requires the existing Cognito workspace bearer authentication and a `foundation_reviewer` role, returns `private, no-store` responses, and can return a CSV export with `?format=csv`. Because the credential is carried in the `Authorization` header rather than a browser cookie, the read endpoint does not depend on an `Origin` header. It does not expose raw IP addresses, session tokens, verification tokens, or salted network or visitor identifiers.

## Release prerequisites

- Deploy `infrastructure/cloudformation/publication-access.yml` with private publication storage, the access table, and the `PublicationIntelligence` index configured.
- Put approved PDFs in the generated private S3 bucket using the keys defined in `app/lib/publications.ts`.
- Remove matching PDFs from `apps/public-site/public/publications` before production release.
- Provide CloudFormation output values to the server runtime, including the salt secret ARN as `PUBLICATION_HASH_SALT_SECRET_ARN`. The server resolves the secret at runtime; never expose its value through `next.config.ts` or a `NEXT_PUBLIC_` variable.
- Keep the SES sender identity verified and require SES production access plus sending enabled before release. Because email verification is the authorization gate, a release must fail closed when public mailbox delivery is not production-ready.
- Keep the 180-day access-record retention rule aligned with the public privacy notice.
