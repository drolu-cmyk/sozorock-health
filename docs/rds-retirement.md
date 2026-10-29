# Permanent RDS retirement

## Decision and evidence

The owner requested permanent retirement of Foundation RDS databases and recovery copies, with no recreation or unnecessary AWS credit consumption. The [October 20 decision record](https://drive.google.com/file/d/1QnaP_QEsIJxfLrga5r9DK_4PzNaDwSff/view) records retirement based on the supplied account inventory. It is not a current AWS inventory.

Reconciliation on October 28, 2026 started from Health commit `8ee335accee17b117d9bba2fd6b2d95ad4ec12ad` and institutional backend commit `47270fb6ac1dfff45471c3036a1217a9d761ee04`.

- PR #232 closed without merging. Later commit `24d51fd` independently disabled production/staging Evidence provisioning, made retired releases fail, and removed database settings from the Health publishing path. Those protections are preserved.
- PR #225 proposed Aurora auto-pause, a commit-message-triggered maintenance operation and CB-CAP WAF removal. Those operations are obsolete under permanent retirement and must not be merged. Current main already has Next 15.5.28 and Nodemailer 10.1.7, matching or exceeding the versions proposed there. No dependency downgrade or WAF removal is part of this reconciliation.
- The separate institutional backend already disabled its deployment job, but its shell entrypoint and database restore proof remained executable outside Actions.

## Repository controls

| Surface | Control |
| --- | --- |
| Production and staging Evidence releases | Disabled AWS jobs retained; no OIDC token permission; retired attempts fail rather than report a successful deployment. |
| Historical Evidence Core template | Unconditional, always-false CloudFormation rule rejects creation and update. No capacity parameter can override it. |
| CB-CAP bootstrap | AWS job disabled; terminal status fails on a skipped bootstrap; OIDC token permission removed. |
| Health deployment policy source | Obsolete RDS creation, snapshot, Data API, secret and related network/key grants removed; database creation, restore, start, modification, copy and promotion explicitly denied. Read-only RDS discovery remains. |
| Institutional deployment and CloudFormation service role sources | RDS wildcard and recovery grants removed. Both roles carry the recreation deny; restricting only the calling role would not constrain a separate CloudFormation service role. |
| Foundation recovery | Contact-stack rollback permission and trust cleanup remain. Recovery no longer installs the obsolete database-secret Allow, preserves existing Deny statements, and adds the recreation deny idempotently. |
| Public Health release | Manual main-branch publishing remains available. Automatic publishing after Verify is paused pending the live account/cost review, so this repository-only correction does not initiate an AWS deployment through that workflow. External Amplify auto-build settings still require live inspection. |
| Related institutional backend | The matching change blocks the standalone deployment script before any AWS call or cleanup trap, rejects its historical RDS template, removes OIDC permission and reports retired releases as failed. |

Historical definitions remain inspectable; they are not operational deployment instructions. Do not remove a template's resources and apply that as a live update: that can trigger deletions or retained snapshots. No current-stack deletion is performed by these repository changes.

Contact intake, publication verification and private downloads, Google mail/SES delivery, Cognito identity, DynamoDB recovery settings, independent S3 storage and the public CB-CAP website release are unchanged. The Foundation parent CloudFront deployment and DNS restoration logic were inspected and contain no RDS provisioning path; they were not changed.

GitHub search also found an Aurora template in `on-bc-canada`. Its deployment is explicitly bound to a separate Canadian AWS account. It is not evidence of Foundation resource consumption, and its state must be reviewed independently before applying the Foundation retirement decision there.

## Live account verification remains outstanding

The AWS console returned **Site Unavailable** during this review. No AWS CLI credentials or RDS/billing administration connector were available. No live AWS resource, IAM policy, snapshot, backup, WAF, DNS record or billing setting was changed. A repository deny is not an installed account control, and a suspended workflow does not stop an already-running job or an external deployment.

Before claiming retirement or savings complete:

1. Verify the signed-in account and billing/linked-account scope. Inventory every enabled Region with pagination, including DB instances, Aurora/global clusters, proxies, instance and cluster snapshots, retained automated backups and replicated backups. Inspect RDS recovery points in AWS Backup vaults and any locks/retention restrictions.
2. Identify every remaining resource and its consumers. Under the owner's permanent-retirement instruction, delete confirmed retired RDS instances/clusters and their authorized recovery copies without new final snapshots. Verify deletion reaches terminal absence. Do not delete contact/publication DynamoDB backups or shared storage.
3. Review active/queued Actions runs, old workflow reruns, Amplify auto-builds, other repositories, CloudFormation service roles and scheduled recovery jobs. Install the reviewed deny controls only after inspecting the actual policies and verifying they preserve necessary account operations. Protect old revisions and other principals at account level where appropriate.
4. Read month-to-date and recent daily usage costs by service, usage type, Region and linked account, separating credits/refunds from resource consumption. Review the credit balance and expiration. Check ongoing RDS storage/backup charges, ECS/Fargate, EC2/EBS, NAT gateways, load balancers, public IPv4, WAF, CloudWatch logs, S3 versions, Amplify builds/hosting and paid model usage. Remove only resources verified unused; preserve live website, forms, mail and security dependencies.
5. Recheck after billing data refreshes. Historical month-to-date charges do not disappear when a resource is deleted. Report observed remaining daily consumption and actual credit balance, not an assumed zero bill.

AWS documents that [retained automated backups and manual snapshots continue to incur charges](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html). CloudFormation [rules are evaluated before resource creation or update](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/rules-section-structure.html).

## Validation

Run `node --test scripts/rds-retirement.test.mjs` and the Foundation recovery, deployment security and bootstrap boundary tests. The recovery transform tests preserve an existing database-secret Deny, remove an obsolete Allow, preserve unrelated permissions and verify idempotence. The related backend regression invokes its retired shell entrypoint against a fake AWS CLI and proves that no AWS call or output directory is created. CI remains the final repository gate.
