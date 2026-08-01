# Explore operations and measurement contract

## Source of truth

Operational records live in the Evidence Core tables `explore_usage_event` and `explore_performance_sample`. They are append-only and carry environment, event/operation, timestamp, retention deadline and (where applicable) geography or workspace scope. Session identifiers are one-way hashes; medical, resident and free-form health data are not accepted.

## Retention

- Production operational events: 180 days by default.
- Staging and test events: 30 days by default.
- A scheduled retention job must delete expired operational records while preserving aggregate release reports and immutable execution audits.

## Measures

- Adoption funnel: `place_resolved`, `brief_viewed`, `map_viewed`, `action_question_asked`, `visuals_viewed`.
- Collaboration: workspace creation, sharing, fork, handoff and funder snapshot events.
- Reliability: p50/p95 latency and success rate by operation and environment.
- Cost: provider-reported token counts and estimated cost micros when an agent response is used.
- Quality: `correction_required` and explicit human-review outcomes.

Test, staging and production environments are kept separate. Only a production `pilot_onboarding_submitted` event can be marked as a traction event, and that event means a reviewable request—not a signed customer, completed pilot or outcome.

## Operating review

Weekly source-health checks inspect retrieval, schema and coverage. Monthly candidate releases produce a guarded review pull request when a source artifact changes. Human reviewers approve source meaning and mapping before a new snapshot can be published.
