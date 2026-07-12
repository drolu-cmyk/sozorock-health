# Backend and release contract

## Authority boundaries

- Clients never hold provider, AI, mail, database, or deployment credentials.
- The API evaluates user role, consent, state readiness, provider verification, feature controls, and disclosure controls before every protected action.
- AI tools execute only through server-side authorization and audit middleware.

## Contact service production adapter

The public contact API validates consent and input, accepts honeypot submissions without processing them, enforces exact-origin and bounded-body checks, applies durable salted-network rate limiting, stores submissions in an encrypted table with time-to-live retention, and publishes a minimal operational notification for `contact@sozorockfoundation.org`. The notification excludes the full message. A managed human-verification challenge is not part of the current release and may be added only if observed abuse warrants the additional accessibility and privacy trade-off.

## Mobile non-clinical access adapter

The mobile access adapter accepts only a journey code, coarse ZIP or Health Equity Hub reference when required, a bounded selection code, interface language, source, and versioned consent. Unknown fields are rejected so contact, health, medical, audio, and transcript data cannot enter the contract. Requests use a physically separate encrypted table with 30-day retention and durable salted-network rate limiting. Until an approved state/licensure-aware directory is connected, the API returns no provider pathways and states that no provider connection was created. See `docs/mobile-access-api.md`.

## GitHub deployment contract

GitHub Actions validates every change. Deployment uses short-lived workload identity through an AWS role, never static cloud credentials. Repository environments hold the deployment role ARN and application identifiers as protected configuration; production requires the GitHub production environment approval policy before promotion.
