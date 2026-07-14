# CB-CAP production security operations

## Release identity

CB-CAP uses a dedicated GitHub OpenID Connect role:

- role: `GitHubOIDC_SozoRockHealth_CBCAP_ProductionRole`
- repository: `drolu-cmyk/sozorock-health`
- GitHub environment: `production`
- application: `d307qqji18y8il`
- branch: `main`
- domain: `cbcap.sozorockfoundation.org`

The versioned trust policy is `infrastructure/iam/github-cbcap-production-trust.json`. Its subject condition accepts only the repository's `production` environment. The permission policy is `infrastructure/iam/github-cbcap-production-policy.json`. It permits only:

- reading and reconciling the one CB-CAP application build definition;
- reading the `main` branch;
- starting and reading `main` release jobs;
- creating, deleting, and reading the exact CB-CAP domain association; and
- discovering and reading the Foundation public hosted zone, reading DNS change status, and changing only `cbcap.sozorockfoundation.org` or its managed-certificate validation labels.

It has no IAM, Secrets Manager, S3, DynamoDB, CloudFormation, WAF, cross-application, apex-domain, sibling-domain, or unrestricted Route 53 permission. Its Route 53 mutation statement is limited by hosted-zone ARN, normalized record name, record type, and action. The GitHub `production` environment is restricted to the exact `main` branch, which is independently protected by the repository's active main-release ruleset. Production runs require the configured environment reviewer before an OIDC token is issued.

Official references:

- [AWS guidance for GitHub OIDC role conditions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [GitHub environment protection API](https://docs.github.com/en/rest/deployments/environments)

## Dedicated web application firewall

`infrastructure/cloudformation/cbcap-waf.yml` defines one global-scope web ACL and associates it only with the CB-CAP Amplify application ARN. AWS documents that Amplify requires a `CLOUDFRONT`-scope web ACL created in `us-east-1`; association applies to the app's branches and domains.

The web ACL blocks requests identified by these AWS-managed baselines:

- Amazon IP reputation list;
- known bad inputs; and
- the common rule set.

It also applies source-IP rate controls only to the read APIs that can create upstream or compute load:

| Path | Limit per source IP | Window |
| --- | ---: | ---: |
| `/api/geography` | 300 requests | 5 minutes |
| `/api/profile` | 120 requests | 5 minutes |
| `/api/trends` | 120 requests | 5 minutes |

The path comparisons use `STARTS_WITH` so query strings do not bypass the controls. The rules do not inspect or collect resident health information. CloudWatch metrics and sampled requests are enabled; full WAF logging is not enabled by this stack.

Official references:

- [How Amplify integrates with AWS WAF](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-waf-configuration.html)
- [CloudFormation web ACL association](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-wafv2-webaclassociation.html)
- [AWS WAF rate-based rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html)

## Cost boundary

AWS WAF is usage billed. At the published standard rates on July 13, 2026, this design starts at approximately USD 11 per month before request volume: USD 5 for one web ACL plus USD 1 for each of the three managed rule-group references and three rate rules. Inspected requests are billed separately; the current pricing page lists USD 0.60 per million requests within the included 1,500 WCU capacity. Prices and taxes can change, so the [AWS WAF pricing page](https://aws.amazon.com/waf/pricing/) is the source of truth before a budget decision.

AWS WAF `CheckCapacity` reports 937 WCU for the selected managed groups and custom rules, below the default 1,500 WCU allocation. Bot Control, fraud-control rule groups, CAPTCHA, larger body-inspection limits, Marketplace rule groups, and full request logging are intentionally excluded to avoid unapproved cost and data-retention expansion.

## Deployment and verification

The WAF stack is a separately authorized security bootstrap, not part of the application deployment role:

```sh
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name sozorock-health-cbcap-waf \
  --template-file infrastructure/cloudformation/cbcap-waf.yml \
  --no-fail-on-empty-changeset
```

Verify the association from both services:

```sh
aws amplify get-app \
  --region us-east-1 \
  --app-id d307qqji18y8il \
  --query 'app.wafConfiguration'

aws wafv2 get-web-acl-for-resource \
  --region us-east-1 \
  --resource-arn arn:aws:amplify:us-east-1:791860731989:apps/d307qqji18y8il
```

## Rollback

If a managed rule creates a confirmed false positive, update only that rule's `OverrideAction` to `Count` in the template and redeploy the stack while the sample is investigated. If the WAF association itself must be removed, delete the stack:

```sh
aws cloudformation delete-stack \
  --region us-east-1 \
  --stack-name sozorock-health-cbcap-waf
```

CloudFormation deletes the association before the web ACL. Confirm stack deletion and that `app.wafConfiguration` no longer reports an association. Deleting or changing the application, branch, domain, DNS, IAM role, or data sources is not part of WAF rollback.
