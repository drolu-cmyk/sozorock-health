# SozoRock Place Intelligence — Milestone 10

## Release boundary

Milestone 10 changes only `/explore`, its versioned APIs, the Evidence Core, and
the infrastructure required for authenticated county workspaces. The marketing
site, global navigation, brand system, CB-CAP, mobile applications,
publications, and contact flow are release-locked by regression tests.

## Runtime services

| Service | Authority | Failure behavior |
| --- | --- | --- |
| Evidence Core | Versioned PostgreSQL/PostGIS records and approved S3 snapshots | Last approved snapshot remains active |
| Place Agent | Responses API through the provider-neutral adapter | Fails closed to an evidence-gap response |
| County Workspace | Tenant-scoped PostgreSQL state and append-only events | Writes fail; prior plan remains readable |
| Real-time events | One-time session token and WebSocket fan-out | Clients resume by event sequence through HTTPS |
| Scenarios | Deterministic `explore.scenario.v1` contract | No reach is calculated without required inputs |
| Funder snapshot | Review-only evidence package and PDF | Unverified claims and promised outcomes are excluded |
| Source control plane | Versioned adapter contracts and immutable executions | Changed schemas require human approval |

## Place Agent execution

1. Resolve the requested geography.
2. Disclose city or ZIP/ZCTA county relationships.
3. Select the canonical county.
4. Load only the approved evidence snapshot.
5. Read source coverage and verified local-plan state.
6. Load compatible map layers.
7. Compare only compatible measures.
8. identify missing evidence.
9. assess response fit for local review.
10. validate every claim and citation.
11. return a structured result for Brief, Map, Action, and Visuals.

The model has no public web-search tool, receives approved tool output only,
uses `store: false`, and cannot diagnose, triage, recommend treatment, infer
individual risk, or convert a national statistical signal into a local priority.

## County workspace contract

- Cognito authenticates participants. Custom claims bind a participant to one
  tenant, role, and access level.
- Every database read and write checks tenant and workspace membership.
- Owners create opaque, hashed, expiring invitation tokens. Tokens are returned
  once and cannot be reused.
- Viewers cannot write. Contributors use optimistic concurrency. Conflicting
  writes return `409` and never overwrite another participant.
- Events use monotonic sequence numbers and idempotency keys.
- Agent suggestions cannot enter the shared plan until an authorized human
  accepts them.
- History tables and audit events are append-only.
- Real-time tokens expire after five minutes, are single use, and authorize
  connection only. All mutations use the authenticated HTTPS API.
- Reconnects resume from the last event sequence.

## Scenario policy

Scenarios are planning ranges, not predictions. Each version retains formulas,
inputs, assumption owner, evidence used, evidence missing, uncertainty range,
model version, creation date, and review status. If verified capacity,
frequency, or workforce inputs are absent, the result is:

> Reach not calculated—local capacity and delivery assumptions are required.

No composite county health score is produced. Any future composite requires a
public methodology, compatible measures, justified weights, sensitivity
analysis, a missing-data rule, and a version identifier.

## Source maintenance

Each adapter contract records its approved hosts, schema fingerprint, discovery
method, schedule, freshness policy, measure mapping, last approved snapshot,
and rollback snapshot. A candidate release may be downloaded and validated,
but schema drift, coverage regression, source withdrawal, or changed meaning
blocks publication and creates a human-review proposal. Failed retrieval never
becomes zero.

## Operations and rollback

1. Run the disposable PostGIS migration test, including rollback and reapply.
2. Validate all 3,144 county briefs and state/DC stratified samples.
3. Run typecheck, zero-warning lint, all tests, clean build, SBOM, runtime scan,
   and browser matrices.
4. Deploy the isolated staging database, real-time stack, and Amplify branch.
5. Run two-session delivery, reconnect, idempotency, concurrency, and viewer
   authorization tests.
6. Compare every non-Explore public route with the current production site.
7. Open a protected pull request. Production remains blocked until every check
   and required approval passes.
8. Before production migration, create a database snapshot and retain the prior
   Evidence Core snapshot and successful Amplify job.
9. On a critical failure, disable the affected capability, restore the prior
   evidence snapshot, retry the prior public Amplify job, purge affected caches,
   and preserve audit history.

The GitHub OIDC role receives the separate, least-privilege
`github-explore-collaboration-policy.json` policy. It is limited to the
Explore evidence/collaboration staging and production stack names, the public
Amplify application, and the named real-time resources. This bootstrap policy
is applied by an account administrator and is not self-expanded by CI.

## Data-retention boundary

County workspaces must not contain PHI or resident-level records. Workspace
content is organizational planning material. Presence is ephemeral. Invitation
and connection tokens expire. Immutable audit history retains actor identity,
tool and version identifiers, hashes, outcome, review action, and timestamp;
it never exposes hidden prompts, reasoning, credentials, or private audit data
to the public.
