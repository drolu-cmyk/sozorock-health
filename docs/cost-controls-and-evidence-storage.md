# Cost controls and evidence storage

## Operational state and boundaries

The institutional CB-CAP product is inactive during product definition. Its dedicated release job is suspended. The public evidence application remains a separate deployment and still reads PostgreSQL through the RDS Data API. The contact form already writes to DynamoDB.

The Evidence Core template defaults to zero minimum capacity and a 900-second auto-pause interval. Production and staging deployment commands explicitly pass `MinimumCapacity=0`, because changing a template default alone does not replace an existing stack parameter. Maximum capacity remains unchanged. An explicit nonzero minimum omits the pause interval so the parameter remains usable when auto-pause is intentionally disabled.

Configuration is not proof of zero compute consumption. Verify recent `ServerlessDatabaseCapacity` values and investigate open connections or incompatible cluster features when instances do not pause. Storage, backups, and public IPv4 addresses have separate costs. Paused instances can still display `available`.

## Authorized maintenance run

The existing trusted `Deploy` workflow recognizes the exact merge-commit marker `[cost-controls-20261016]` after a successful `Verify` run on `main`. For that marker it skips the ordinary public-site deployment and runs narrowly scoped maintenance jobs. Normal deployment events retain their existing behavior. The maintenance checkout must still match the current protected main branch.

The jobs use existing deployment roles; no IAM policies or trust rules are changed. They run the tested `scripts/apply-cost-controls.py` with `--apply`. Without that flag the script only inspects resources. It:

- requires the expected Foundation account;
- checks the three identified Aurora clusters and preserves their maximum capacity while reconciling zero minimum and 900-second auto-pause;
- attempts to make only the explicitly identified legacy nonproduction writer private after verifying its instance, cluster, engine, and class; this blocks direct connections from outside its VPC, and is not proof that the database is unused;
- reads recent capacity metrics without opening database connections;
- attempts to disable CB-CAP app and main-branch automatic builds;
- validates the dedicated CB-CAP WAF stack contains only the exact authorized ACL and its association, saves its original template, then requests deletion;
- records each permission denial or incomplete operation explicitly rather than treating an attempted operation as a verified saving.

The WAF deletion removes protections from the currently hosted CB-CAP application. It does not unpublish the app, stop an external API, or prevent independent deployment mechanisms. A private maintenance page or verified branch access control is required if the product must be unavailable to the public. For SSR access control, follow Amplify's required redeployment procedure before treating password protection as active.

No database is deleted or stopped, no SQL or secret values are read, and no Elastic IP is manually released. The public evidence production and staging databases must not be labeled institutional CB-CAP databases merely because the product names are related. The legacy `sozorock-np` consumer remains unidentified.

Maintenance artifacts contain scoped operation reports and, when available, the WAF template backup. They are retained for 30 days. A `deletion_requested` result requires a later check that the stack is absent and the Amplify WAF association has cleared. A configured zero minimum requires metric verification. An operation blocked by IAM requires an operator with existing sufficient authority; do not expand roles automatically.

If a one-off maintenance run needs to be repeated, use a reviewed maintenance change and a fresh successful Verify run with the same explicit marker. Do not rerun an old checkout after main has advanced. Remove the one-off jobs after the shutdown has been verified.

## DynamoDB migration scope

Moving forms is not an RDS migration: the contact route already uses `DynamoDBDocumentClient`, `PutCommand`, and the contact-submissions table. The outstanding RDS dependency is the evidence and collaboration authority.

The current relational runtime verifies published snapshot approval, source versions, canonical county geography, capability switches, and execution audit records. Other migrations add collaboration, recipient binding, publication controls, and runtime privileges. Replacing these requires an access-pattern design and authorization parity; a table-for-table import is insufficient.

Keep the route and evidence contracts stable and replace the storage boundary behind them in a separate reviewed migration. The following is a proposed design, not a deployed schema:

| Access pattern | Proposed storage | Required invariant |
| --- | --- | --- |
| Read one approved snapshot | DynamoDB manifest keyed by content hash | Verified publication state and immutable hash |
| Read a county brief for a snapshot | Precomputed artifact in S3, manifest keyed by snapshot and county | Snapshot identity, source dates, coverage, provenance, and missing values preserved |
| Read a capability switch | DynamoDB key lookup | Missing or disabled switch remains disabled |
| Resolve canonical county identity | Versioned DynamoDB geography record | Census authority, vintage, and stable identity preserved |
| Append execution audit | DynamoDB append record, partitioned by tenant/date and execution identity | Conditional uniqueness, authorization, and retention preserved |
| Update workspace state | Separate tenant-scoped DynamoDB records and conditional transactions | Recipient binding, ownership, publication state, and concurrency checks preserved |
| Store raw evidence and large artifacts | Private versioned S3 objects | Immutable source/version identity, checksums, access restrictions |

Use on-demand DynamoDB capacity initially and estimate storage, backups, indexes, requests, and S3 delivery separately. Avoid request-path table scans. Do not use TTL for records that require durable audit retention. Large county/source payloads should remain in S3 rather than assuming they fit a DynamoDB item.

## Cutover gates

1. Export the actual required evidence records and artifact manifests using an authorized operator; preserve a recoverable database backup. Do not copy secrets or resident data into this repository.
2. Reconcile record counts, content hashes, snapshot publication status, and source/geography links. Do not replace missing measurements with zero.
3. Implement the storage adapters and populate the candidate stores without changing the active production read path.
4. Compare current and candidate responses for all counties and representative evidence, permission, collaboration, and audit operations. Include stale snapshot, unavailable source, rejected capability, concurrent write, and unauthorized recipient cases.
5. Switch staging first with an explicit rollback path. Keep production on the old authority until parity and access-control tests pass.
6. Switch production, then verify application configuration, deployment scripts, scheduled jobs, and logs no longer depend on RDS. Do not run conflicting dual-write authorities without an explicit reconciliation design.
7. Retire only the confirmed obsolete database instances and clusters after backup and recovery validation. Remove obsolete runtime secrets, monitoring, and public addresses only after their owners and remaining consumers are checked.

No DynamoDB cutover or database retirement is implied by the cost-control change. Keep the current evidence authority functional until the replacement is verified.

## References

- [Aurora Serverless v2 auto-pause](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html)
- [CloudFormation scaling configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-rds-dbcluster-serverlessv2scalingconfiguration.html)
- [Amplify branch access control](https://docs.aws.amazon.com/amplify/latest/userguide/access-control.html)
- [Amplify firewall pricing](https://docs.aws.amazon.com/amplify/latest/userguide/waf-pricing.html)
- [DynamoDB SQL-to-NoSQL guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SQLtoNoSQL.html)
