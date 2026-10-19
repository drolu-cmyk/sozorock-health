# RDS retirement

The owner permanently retired the Foundation RDS databases and their recovery copies on October 19, 2026, and deferred subdomain releases.

The AWS provisioning jobs in `explore-production.yml` and `milestone-10-staging.yml` are disabled. Their local database tests remain available. Restoring AWS database provisioning requires an explicitly approved repository change and a funded operating plan.

The Health public-site deployment is manual on `main`. Successful verification runs no longer publish the subdomain automatically. Existing publication verification, private downloads, contact storage and mail delivery are preserved. This change does not deploy application code or alter existing AWS resources.

These controls apply to the current repository workflows. They do not prevent an AWS administrator, another repository, or an older workflow revision from creating a database. Account-level permissions and linked-account costs must be reviewed separately.
