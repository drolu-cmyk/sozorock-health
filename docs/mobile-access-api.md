# Mobile non-clinical access request API

`POST /v1/access-requests` is the production adapter for the iOS and Android Resident Access Layer. The public Amplify origin is the API base, so the mobile release value is:

```text
EXPO_PUBLIC_ACCESS_API_URL=https://health.sozorockfoundation.org
```

## Contract

The client sends only:

- `journey`: `care`, `hub`, or `language`
- `location`: a 5-digit ZIP code for care readiness, or a resident-entered Health Equity Hub name/code
- `selection`: a bounded readiness or language code where that journey uses one
- `locale`: `en` or `es`
- `source`: `mobile`
- `consent`: the explicit boolean `true`
- `consentVersion`: `mobile-access-v1`
- `website`: an empty honeypot field when present

The endpoint rejects unknown fields. Names, email addresses, symptoms, diagnoses, medication, records, precise coordinates, audio, and transcripts are outside this contract.

The current adapter does not have an approved provider-readiness directory. It therefore stores the consented, non-clinical request and returns an empty `pathways` array with clear language that no provider connection was created. This fail-closed behavior prevents an unverified or out-of-state provider from being returned.

## Controls

- HTTPS production base URL; exact-origin CORS with no wildcard and a native-client identifier
- 4 KB request limit, JSON-only parsing, strict allowlisted fields, journey-specific validation, and a honeypot
- durable per-network limit of 10 requests per hour using a salted one-way network hash
- encryption at rest, point-in-time recovery, and DynamoDB TTL
- access requests are scheduled for deletion after 30 days through DynamoDB TTL; rate-limit records are scheduled for deletion after two hours
- separate access-request table from public contact records and all CB-CAP data
- operational notification contains no resident-entered location or selection
- `Cache-Control: no-store`; server logs contain event names and error classes, not request bodies

The `x-sozorock-client: mobile-v1` header is a routing and abuse signal, not authentication. A distributed public app cannot safely hold a shared secret. Rate limits, strict validation, minimum data, and fail-closed provider matching are the enforcement controls.

## Deployment wiring

`infrastructure/cloudformation/contact-backend.yml` provisions the separate access table and rate-limit salt alongside the existing public compute role. `.github/workflows/deploy.yml` publishes these server-only environment variables to the public Amplify app:

- `ACCESS_REQUESTS_TABLE`
- `ACCESS_NOTIFICATION_TOPIC_ARN`
- `ACCESS_RATE_LIMIT_SALT_SECRET_ARN`
- `ACCESS_ALLOWED_ORIGINS`

The app may be configured with the production API base only after the stack update and a live `POST /v1/access-requests` smoke test succeed.
