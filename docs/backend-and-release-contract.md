# Backend and release contract

## Authority boundaries

- Clients never hold provider, AI, mail, database, or deployment credentials.
- The API evaluates user role, consent, state readiness, provider verification, feature controls, and disclosure controls before every protected action.
- AI tools execute only through server-side authorization and audit middleware.

## Contact service production adapter

The public contact API validates consent and input, rejects honeypot submissions, and rate-limits requests. Production adds durable rate limiting, encrypted submission storage, minimal audit events, managed human verification, notification to `contact@sozorockfoundation.org`, retention enforcement, and deletion workflows. The in-process limiter is local-development protection only and cannot be treated as a production control.

## GitHub deployment contract

GitHub Actions validates every change. Deployment uses short-lived workload identity through an AWS role, never static cloud credentials. Repository environments hold the deployment role ARN and application identifiers as protected configuration; production requires the GitHub production environment approval policy before promotion.
