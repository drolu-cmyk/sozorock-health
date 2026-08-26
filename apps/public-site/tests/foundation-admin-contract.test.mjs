import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Foundation admin surface is private, noindex and browser-storage free", async () => {
  const page = await read("app/admin/page.tsx");
  const client = await read("app/admin/AdminClient.tsx");
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  assert.match(client, /Private access for authorized Foundation reviewers/);
  assert.match(client, /Authenticator protection is required/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});

test("Foundation admin authentication uses secure cookies and mandatory software MFA", async () => {
  const auth = await read("app/lib/foundation-admin-auth.ts");
  const session = await read("app/api/admin/session/route.ts");
  const mfa = await read("app/api/admin/mfa/route.ts");
  assert.match(auth, /__Host-srh_foundation_admin/);
  assert.match(auth, /role !== "foundation_reviewer"/);
  assert.match(auth, /access !== "owner" && access !== "contributor"/);
  assert.match(auth, /tenantId !== expectedTenantId/);
  assert.match(auth, /FOUNDATION_ADMIN_TENANT_ID/);
  assert.match(auth, /Foundation reviewer MFA is required/);
  assert.match(auth, /AssociateSoftwareTokenCommand/);
  assert.match(auth, /VerifySoftwareTokenCommand/);
  assert.match(auth, /SetUserMFAPreferenceCommand/);
  assert.match(session, /httpOnly:\s*true/);
  assert.match(session, /secure:\s*true/);
  assert.match(session, /sameSite:\s*"strict"/);
  assert.match(session, /isTrustedSameOrigin\(request\)/);
  assert.match(session, /NEW_PASSWORD_REQUIRED/);
  assert.match(session, /SOFTWARE_TOKEN_MFA/);
  assert.match(mfa, /requireFoundationIdentity\(request\)/);
  assert.match(mfa, /isTrustedSameOrigin\(request\)/);
  assert.match(mfa, /otpauth:\/\/totp/);
});

test("reviewer APIs require MFA-backed Foundation reviewer authorization", async () => {
  const contacts = await read("app/api/admin/contacts/route.ts");
  const publications = await read("app/api/admin/publications/[slug]/route.ts");
  const legacyPublications = await read("app/api/publications/intelligence/[slug]/route.ts");
  for (const source of [contacts, publications, legacyPublications]) {
    assert.match(source, /requireFoundationReviewer\(request\)/);
    assert.match(source, /Cache-Control": "private, no-store/);
    assert.match(source, /Referrer-Policy": "no-referrer/);
  }
  assert.doesNotMatch(legacyPublications, /requireWorkspaceActor/);
  assert.match(contacts, /ContactIntelligence/);
  assert.ok(contacts.includes('endsWith("@simulator.amazonses.com")'));
});

test("contact stack keeps reviewer access within its already-authorized inline policy", async () => {
  const template = await read("../../infrastructure/cloudformation/contact-backend.yml");
  assert.match(template, /IndexName: ContactIntelligence/);
  assert.match(template, /AttributeName: recordType/);
  assert.match(template, /Action: dynamodb:Query/);
  assert.match(template, /\$\{ContactSubmissions\.Arn\}\/index\/ContactIntelligence/);
  assert.match(template, /FoundationAdminUserPoolArn:/);
  assert.match(template, /Default: ''/);
  assert.match(template, /FoundationAdminConfigured:/);
  assert.match(template, /PolicyName: ContactIntakeOnly/);
  assert.match(template, /cognito-idp:AdminInitiateAuth/);
  assert.match(template, /cognito-idp:AdminRespondToAuthChallenge/);
  assert.match(template, /Resource: !Ref FoundationAdminUserPoolArn/);
  assert.doesNotMatch(template, /cognito-idp:\*/);
});

test("production workflow proves admin, MFA, intake and trust recovery boundaries", async () => {
  const workflow = await read("../../.github/workflows/foundation-consolidation-production.yml");
  const mfaSmoke = await read("../../scripts/enroll-foundation-smoke-mfa.sh");
  const trustScript = await read("../../scripts/reconcile-foundation-recovery-trust.sh");
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /--stack-name sozorock-health-contact/);
  assert.match(workflow, /FoundationAdminUserPoolArn="\$FOUNDATION_ADMIN_COGNITO_USER_POOL_ARN"/);
  assert.match(workflow, /foundation_reviewer/);
  assert.match(workflow, /enroll-foundation-smoke-mfa\.sh "\$access_token"/);
  assert.match(mfaSmoke, /associate-software-token/);
  assert.match(mfaSmoke, /verify-software-token/);
  assert.match(mfaSmoke, /set-user-mfa-preference/);
  assert.match(workflow, /api\/admin\/contacts/);
  assert.match(workflow, /api\/publications\/access\/health-systems-assurance-volume-1/);
  assert.ok(workflow.includes("success@simulator.amazonses.com"));
  assert.match(workflow, /test "\$contact_admin_status" = '403'/);
  assert.match(workflow, /reconcile-foundation-recovery-trust\.sh bridge/);
  assert.match(workflow, /reconcile-foundation-recovery-trust\.sh repair/);
  assert.match(workflow, /reconcile-foundation-recovery-trust\.sh repair-health-policy/);
  assert.match(workflow, /reconcile-foundation-recovery-trust\.sh restore/);
  assert.doesNotMatch(workflow, /stack-update-rollback-complete/);
  assert.match(workflow, /contact_stack_status.*UPDATE_ROLLBACK_COMPLETE/s);
  assert.match(workflow, /cloudformation describe-stack-events/);
  assert.match(workflow, /ContactTableName output is empty/);
  assert.match(workflow, /ContactIntelligence index ended with status/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(trustScript, /RepairOnlyAiLabTrustForFoundationRecovery/);
  assert.match(trustScript, /repo:drolu-cmyk@271617784\/sozorock-foundation@1337104562:ref:refs\/heads\/main/);
  assert.match(trustScript, /iam:GetRole/);
  assert.match(trustScript, /iam:UpdateAssumeRolePolicy/);
  assert.match(trustScript, /RepairOnlyHealthDeploymentPolicyForFoundationRecovery/);
  assert.match(trustScript, /cloudformation:ContinueUpdateRollback/);
  assert.match(trustScript, /GitHubOIDC_SozoRockHealthV2_DeployRole/);
  assert.match(trustScript, /sozorock-health-contact/);
  assert.doesNotMatch(trustScript, /iam:\*/);
});
