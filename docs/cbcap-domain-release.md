# CB-CAP production-domain release

## Fixed production boundary

- Application: CB-CAP only
- Application identifier: `d307qqji18y8il`
- Source branch: `main`
- Canonical domain: `https://cbcap.sozorockfoundation.org`
- Repository: `drolu-cmyk/sozorock-health`

The release workflow does not modify the Foundation apex, the health website, or any sibling subdomain. It requests one exact domain association for `cbcap.sozorockfoundation.org`, disables automatic subdomains, and maps only the empty prefix of that exact name to the `main` branch. Its Route 53 mutation permission is restricted by hosted-zone ARN, normalized record name, and record type to the exact CB-CAP hostname and its managed-certificate validation names.

## Why the association uses the exact subdomain

AWS Amplify accepts a domain name that is itself a subdomain, and its subdomain setting permits an empty prefix. This lets CB-CAP use `cbcap.sozorockfoundation.org` as its complete isolated domain association instead of claiming `sozorockfoundation.org` or changing a domain association used by another application.

For a domain hosted in Route 53, Amplify performs domain verification and managed-certificate DNS validation automatically. AWS performs those Route 53 calls in the deployment session, so the deployment identity receives only the minimum discovery, read, change-status, and record-change permissions needed for this hosted zone. `ChangeResourceRecordSets` is constrained to `cbcap.sozorockfoundation.org` and `*.cbcap.sozorockfoundation.org`, and to A, AAAA, and CNAME records. The role cannot change the Foundation apex, health website, or any sibling name.

Official references:

- [Managing subdomains in Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/to-manage-subdomains.html)
- [CreateDomainAssociation API](https://docs.aws.amazon.com/amplify/latest/APIReference/API_CreateDomainAssociation.html)
- [AWS CLI `create-domain-association`](https://docs.aws.amazon.com/cli/latest/reference/amplify/create-domain-association.html)
- [Amplify DNS verification and activation](https://docs.aws.amazon.com/amplify/latest/userguide/understanding-dns-terminology-and-concepts.html)
- [Amplify IAM resource types](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awsamplify.html)

AWS notes that DNS propagation and managed-certificate issuance can take up to 24 hours. The workflow waits for 30 minutes, fails visibly rather than reporting a false live release, and is safe to rerun while activation continues.

## Automated safeguards

`.github/workflows/deploy-cbcap.yml`:

1. always checks out `main`;
2. installs the committed lockfile;
3. runs CB-CAP type checks, lint, tests, production build, and the production-dependency audit, then rejects any tracked-source mutation from those gates;
4. assumes the production deployment role through GitHub OpenID Connect;
5. refuses an unexpected application, repository, or branch;
6. reconciles the version-controlled CB-CAP build definition;
7. pins the approved checkout to the protected remote `main` SHA before release, verifies that `main` did not move before or during the job, and accepts only that SHA (or Amplify's connected-repository `HEAD` marker) as the job source identity;
8. creates the exact domain association only when absent, or retries a failed first-time activation after the DNS boundary is in place;
9. fails closed if an existing association has any unexpected mapping;
10. waits for the managed certificate and verified domain;
11. verifies public DNS and TLS through a real HTTPS request;
12. verifies canonical-domain output, security headers, HTTPS redirection, and the 3,144-county/51-state national API contract.

The workflow asks Amplify to manage the exact custom-domain records. It receives no domain-delete, wildcard-domain, apex-domain, data-store, secret, IAM, or cross-product permission.

## Dedicated deployment role

CB-CAP uses `GitHubOIDC_SozoRockHealth_CBCAP_ProductionRole`, not the broader SozoRock Health deployment role. Its trust policy accepts only `repo:drolu-cmyk/sozorock-health:environment:production`. Its single inline policy is versioned at `infrastructure/iam/github-cbcap-production-policy.json` and grants only the exact app, `main` branch and jobs, and domain resources required by `.github/workflows/deploy-cbcap.yml`.

The exact-domain statement grants only:

- `amplify:CreateDomainAssociation`
- `amplify:GetDomainAssociation`
- `amplify:UpdateDomainAssociation`

for:

`arn:aws:amplify:us-east-1:791860731989:apps/d307qqji18y8il/domains/cbcap.sozorockfoundation.org`

The Route 53 statements allow hosted-zone discovery, read-only inspection of hosted zone `Z07905293AANZWGYZ84F3`, change-status reads, and record changes only for the exact CB-CAP name and its managed-certificate validation labels. The GitHub `production` environment holds `CBCAP_AWS_DEPLOY_ROLE_ARN`; the workflow contains no long-lived AWS credential.

The dedicated WAF boundary and rollback procedure are documented in [CB-CAP production security operations](cbcap-security-operations.md).

## Live acceptance criteria

A release is complete only when all of the following are true:

- the CB-CAP release job succeeds for the approved `main` commit;
- the exact domain association reports `AVAILABLE`;
- its only mapping is empty prefix to `main` and that mapping reports `verified: true`;
- `https://cbcap.sozorockfoundation.org/` passes public DNS resolution and managed TLS validation;
- HTTP redirects to the same host over HTTPS;
- the final page does not redirect to an Amplify default hostname or another SozoRock property;
- the HTML identifies the custom domain as canonical;
- CSP, HSTS, and `X-Content-Type-Options: nosniff` are present;
- `/api/dashboard` returns 3,144 county equivalents, 51 state/DC summaries, and 3,144 unique county FIPS codes.
- the live 2025 boundary artifact contains 3,144 unique county identifiers, contains the expected current Connecticut planning-region and Alaska census-area FIPS codes, and exactly matches the committed SHA-256 manifest;
- plain HTTP redirects only to the exact HTTPS CB-CAP host; and
- the dedicated web ACL reports a successful association with the CB-CAP application.

If any criterion fails, the workflow fails and the release must not be reported as live.
