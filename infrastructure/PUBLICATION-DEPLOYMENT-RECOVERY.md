# Publication deployment recovery — 7 September 2026

The Google mail release passed SMTP authentication, but release run 34162748016 stopped before publishing: the existing `sozorock-health-contact` stack had been in `UPDATE_ROLLBACK_FAILED` since August. CloudFormation could not read the contact table's tags through `GitHubOIDC_SozoRockHealthV2_DeployRole`.

Recovery resumed rollback without skipping resources. The stack reached `UPDATE_ROLLBACK_COMPLETE`; no table was replaced or deleted. The existing bootstrap policy was backed up, then `dynamodb:ListTagsOfResource` was added to its existing three explicitly named contact/access/publication tables. IAM simulation returned `allowed` for the contact table. The same immutable release was retried.

The checked-in bootstrap policy now includes this tag-read permission and the existing workflow's `amplify:UpdateBranch` action. The latter was already permitted in the live role through another policy. This reconciles the bootstrap source without adding wildcard resources.

A successful rollback is a deployment prerequisite, not proof of publication delivery. Release acceptance still requires the production deployment checks, receipt of a verification email, verification confirmation, and the authorized private PDF download.
