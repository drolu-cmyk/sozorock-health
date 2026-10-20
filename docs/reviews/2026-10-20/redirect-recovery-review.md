# Redirect and recovery review — October 20, 2026

The current Foundation redirect PR is internally consistent with 301. The AI Lab recovery workflow remains inconsistent and can automatically mutate infrastructure when its own file changes on `main`. Replacing its two 308 assertions alone would not resolve that operational conflict.

No repository files were changed. No workflow was dispatched, no AWS operation was performed, no issue comment was sent, and no live form or email submission was made. Exact fetched files and structured verification status are in this folder; `redirect-audit-status.json` records source blob hashes.

## Current state and checks

- [Foundation PR #125](https://github.com/drolu-cmyk/sozorock-foundation/pull/125): open, draft, unmerged, mergeable; head `cd43082aee149c14a45da061c5e49cca652d843d`, base `ada2d34a1ce4dbf8ff23dde6ec5acfc9c1cc2999`. The head is unchanged from the handoff.
- [Existing CI run 39469998597](https://github.com/drolu-cmyk/sozorock-foundation/actions/runs/39469998597): successful, pull-request event, attempt 1, exact head above; ran October 20 at 17:53–17:54 UTC. Its build, Sites tests, AWS release-contract validation, dependency audits, restricted deployment/rollback tests and YAML validation succeeded. This is a freshly inspected prior run, not a newly executed full CI run.
- Fresh local verification: **8/8 redirect tests pass on Node v24.19.0**, using isolated copies of the exact PR-head function, tests, publisher script and workflow. No external or AWS commands execute in these tests.
- AI Lab `main`: `13d2569f1c48627e4eea8f00affefdc02967779b`. Its current recovery file blob matches the pinned source inspected here. The latest matching recovery run in the first 100 returned runs was [32781434200](https://github.com/drolu-cmyk/sozorock-ai-lab/actions/runs/32781434200), a failed August 24 push run. That result does not verify today's production state.
- Neither main-branch response reported branch protection (`protected: false`). Production environment approvals and restrictions were not inspected; merely naming `environment: production` in YAML does not establish an approval gate.
- No legacy publisher run appeared in the latest 100 Foundation runs. The workflow remains unmerged. The PR body records that it has not been run; this review did not run it or claim an exhaustive historical execution audit.

## Foundation PR #125: exact contract

All paths below refer to head `cd43082aee149c14a45da061c5e49cca652d843d`.

| File / lines | Verified behavior |
| --- | --- |
| `infra/cloudfront/legacy-health-redirect.js`, 5–9 | Unexpected hosts return 403; methods other than GET/HEAD and retired `/api/` operations return 410. |
| Same file, 12–20 | 301; `/about` and `/about/` map to Health `/work`; four CB-CAP aliases map to the CB-CAP root. Only the existing five campaign query keys are forwarded. |
| `.github/workflows/publish-legacy-health-redirect.yml`, 3–4, 15, 18–21 | Manual dispatch only; Foundation repository and main branch condition; production environment; job permissions `contents: read` and `id-token: write`. |
| Same workflow, 23–26, 45–47 | Three required owner variables; optional AWS region; fail when required values are empty. |
| Same workflow, 59–71 | Backup and successful artifact preservation precede update/test/publish. Actions are pinned to commit SHAs; checkout does not persist credentials. |
| `scripts/publish-legacy-health-redirect.mjs`, 15–26 | Distribution must be enabled and deployed, serve exactly the two legacy aliases, and already associate the expected viewer-request function with every cache behavior. |
| Same script, 90–140 | Backs up both stages, checks ETags, tests DEVELOPMENT, then publishes with the freshly rechecked tested ETag; no distribution-association changes. |
| Same script, 145–176 | Verifies all six URL/path combinations as 301 and final 200, with a ten-minute deadline. No automatic rollback. |
| `tests/legacy-health-redirect.test.mjs`, 50–55 | Explicitly rejects 308, temporary redirects, wrong destinations and nonredirect responses. |

Required six-case verification: each of `sozorockhealth.com` and `www.sozorockhealth.com`, for `/` → `https://health.sozorockfoundation.org/`, `/about` → `https://health.sozorockfoundation.org/work`, and `/cb-cap` → `https://cbcap.sozorockfoundation.org/`.

## AI Lab correction proposal

Source: [`.github/workflows/complete-foundation-production-recovery.yml`](https://github.com/drolu-cmyk/sozorock-ai-lab/blob/13d2569f1c48627e4eea8f00affefdc02967779b/.github/workflows/complete-foundation-production-recovery.yml).

| Current lines | Concrete correction |
| --- | --- |
| 3–8 | Remove `push` with its main/path filter. Retain manual dispatch only, so a correction commit cannot itself start recovery. |
| 28 | Add `github.event_name == 'workflow_dispatch'` to the repository/main condition as an additional guard. |
| 34–36, 48 | Pin reviewed action commits; checkout `${{ github.sha }}` rather than the moving `main` ref. |
| 166–226 | Retire or isolate the legacy Health Amplify rebuild/domain-association path. The Foundation publisher manages the observed CloudFront function. Do not update Amplify domain associations or start a RELEASE job merely to verify redirects. |
| 228–249 | Replace the old verifier with the six-case 301/final-200 contract above. The exact outdated comparisons are **line 236** (`status == '308'`) and **line 248** (`cb_status == '308'`). Existing code checks only both roots and apex CB-CAP; it omits `/about`, www CB-CAP and final destination status. |
| 251–253, 267–269 | Remove the claim/output that verification occurred after an Amplify deployment when using a read-only verifier. Record results as an artifact/step summary. |
| 10–13, 39–44, 255–269 | A redirect-only verification job needs `contents: read`; no OIDC token or `issues: write`. Remove automatic issue comments from that job. |
| 55–164, 271–276 | Separate IAM provisioning from redirect verification. The current combined job edits role trust/policies and grants broader Foundation deployment rights; a redirect check must neither perform nor depend on that provisioning. |

This proposal is source-only and unapplied. It does not authorize running either workflow. If legacy Amplify recovery remains necessary for some other purpose, its owner must first verify domain ownership and provide a separate reviewed service-specific runbook. Do not preserve two independent writers for the same legacy-host redirect.

Additional recovery path: `.github/workflows/run-foundation-amplify-recovery.yml` also has a main push trigger tied to its own file. It is a distinct Foundation recovery workflow, so an owner should include it in the recovery-path inventory before any future infrastructure recovery. This review did not change or run it.

## Remaining owner and permission gates

The Foundation workflow requires `LEGACY_HEALTH_DISTRIBUTION_ID`, `LEGACY_HEALTH_FUNCTION_NAME`, `LEGACY_HEALTH_DEPLOY_ROLE_ARN`; `AWS_REGION` defaults to `us-east-1`. Their existence, values, ownership and actual IAM permissions remain unverified. Resource identifiers are intentionally omitted from this report.

The publisher's narrow AWS permission set is:

- `cloudfront:GetDistribution` on the configured distribution.
- `cloudfront:DescribeFunction`, `cloudfront:GetFunction`, `cloudfront:UpdateFunction`, `cloudfront:TestFunction`, `cloudfront:PublishFunction` on the configured function.
- OIDC trust limited to the Foundation production environment subject `repo:drolu-cmyk/sozorock-foundation:environment:production` and audience `sts.amazonaws.com`.

No Amplify, Route 53, ACM, IAM mutation, CloudFormation, association update or invalidation permission is used by this publisher. The owner still needs to confirm that the actual role is bounded accordingly, production environment restrictions are active, the two aliases belong to that distribution, `/about` → `/work` is the intended mapping, and the saved LIVE backup can be used for an explicitly approved rollback. These are release gates, not completed checks.

Primary permission references: [AWS CloudFront actions/resources](https://docs.aws.amazon.com/service-authorization/latest/reference/list_cloudfront.html) and [GitHub OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws). No role policy or trust was modified.

## Five-page metadata source check

The current local website work was inspected read-only. These findings concern source definitions, not live indexing.

| Page | Title | Canonical |
| --- | --- | --- |
| Health Home | Primary Care Access in New York \| SozoRock Health | `https://health.sozorockfoundation.org/` |
| Health Our Work | Health Equity Initiative \| SozoRock Health | `https://health.sozorockfoundation.org/work` |
| Health Interest List | Primary Care Access Program Interest List \| SozoRock Health | `https://health.sozorockfoundation.org/interest` |
| Health Privacy | Privacy notice \| SozoRock Health | `https://health.sozorockfoundation.org/privacy` |
| Foundation Events | Roundtables, Fireside and Briefings \| SozoRock Foundation | `https://www.sozorockfoundation.org/events` |

Each has a distinct description and self-referential canonical in its metadata code. The four Health pages use shared Open Graph/Twitter metadata with an absolute title and production metadata base. Their public source defaults permit indexing; the existing middleware intentionally adds `noindex, nofollow` on staging/Amplify preview hosts. All four Health routes appear in the sitemap; Events appears in the Foundation build route list. Events evaluates to `CollectionPage` with organization/site/breadcrumb schema, without an invented dated Event record. Its description preserves the planned-series status. Home and Interest match the handoff metadata targets. No change to Spanish pages is proposed or made.

No defect was found in those five page metadata definitions within this bounded check. Browser-emitted metadata, deployed robots/sitemap responses, Search Console indexing and email delivery remain separate validation work.
