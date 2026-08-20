import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = fileURLToPath(new URL("../app", import.meta.url));
const accessSource = readFileSync(
  new URL("../app/lib/publication-access.ts", import.meta.url),
  "utf8",
);
const accessRouteSource = readFileSync(
  new URL("../app/api/publications/access/[slug]/route.ts", import.meta.url),
  "utf8",
);
const accessFormSource = readFileSync(
  new URL("../app/components/PublicationAccessForm.tsx", import.meta.url),
  "utf8",
);
const validationSource = readFileSync(
  new URL("../app/lib/publication-validation.ts", import.meta.url),
  "utf8",
);
const deployWorkflow = readFileSync(
  new URL("../../../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);
const publicationInfrastructure = readFileSync(
  new URL("../../../infrastructure/cloudformation/publication-access.yml", import.meta.url),
  "utf8",
);
const eventRoute = readFileSync(
  new URL("../app/api/publications/events/route.ts", import.meta.url),
  "utf8",
);
const deploymentPolicy = JSON.parse(
  readFileSync(
    new URL("../../../infrastructure/iam/github-amplify-bootstrap-policy.json", import.meta.url),
    "utf8",
  ),
);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".mjs", ".css"].includes(extname(path))
      ? [path]
      : [];
  });
}

test("publication delivery uses short-lived signed links from the private asset bucket", () => {
  assert.match(accessSource, /S3Client/);
  assert.match(accessSource, /HeadObjectCommand/);
  assert.match(accessSource, /GetObjectCommand/);
  assert.match(accessSource, /getSignedUrl/);
  assert.match(accessSource, /ResponseContentDisposition/);
  assert.match(accessSource, /expiresIn: 300/);
  assert.match(deployWorkflow, /aws s3 sync infrastructure\/assets\/publications/);
  assert.match(deployWorkflow, /--sse AES256/);
  assert.match(publicationInfrastructure, /BlockPublicAcls: true/);
  assert.match(publicationInfrastructure, /BlockPublicPolicy: true/);
  assert.match(publicationInfrastructure, /RestrictPublicBuckets: true/);
  assert.match(publicationInfrastructure, /ObjectOwnership: BucketOwnerEnforced/);
  assert.match(publicationInfrastructure, /Sid: DenyInsecureTransport/);
  assert.match(publicationInfrastructure, /aws:SecureTransport: 'false'/);
});

test("the deploy role can manage only the exact private publication bucket policy", () => {
  const statement = deploymentPolicy.Statement.find(
    ({ Sid }) => Sid === "ProvisionControlledPublicationStorage",
  );
  assert.ok(statement);
  assert.equal(
    statement.Resource,
    "arn:aws:s3:::sozorock-health-publications-791860731989-us-east-1",
  );
  assert.deepEqual(
    ["s3:GetBucketPolicy", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy"].filter(
      (action) => !statement.Action.includes(action),
    ),
    [],
  );
});

test("publication access state changes are atomic and supported by least privilege IAM", () => {
  assert.match(accessSource, /TransactWriteCommand/);
  assert.match(accessSource, /TransactItems:/);
  assert.match(accessSource, /attribute_not_exists\(consumedAt\) AND expiresAt >= :epoch/);
  assert.match(publicationInfrastructure, /dynamodb:TransactWriteItems/);
  assert.match(publicationInfrastructure, /Resource: !GetAtt PublicationAccessTable\.Arn/);
});

test("validated publication requests establish secure access before best-effort email delivery", () => {
  const createRequestStart = accessSource.indexOf("export async function createAccessRequest");
  const sessionWrite = accessSource.indexOf("pk: `SESSION#${sessionHash}`", createRequestStart);
  const emailSend = accessSource.indexOf("await ses.send", createRequestStart);
  assert.ok(createRequestStart >= 0);
  assert.ok(sessionWrite > createRequestStart);
  assert.ok(emailSend > sessionWrite);
  assert.match(accessSource, /expiresAt: epoch \+ SESSION_SECONDS/);
  assert.match(accessSource, /verification_delivery_failed/);
  assert.match(accessSource, /return \{ requestId, sessionToken, verificationSent \}/);
  assert.match(accessRouteSource, /accessGranted: true/);
  assert.match(accessRouteSource, /downloadUrl: `\/api\/publications\/download\/\$\{publication\.slug\}`/);
  assert.match(accessRouteSource, /response\.cookies\.set\(accessCookieName\(\), access\.sessionToken/);
  assert.match(accessRouteSource, /httpOnly: true/);
  assert.match(accessRouteSource, /sameSite: "lax"/);
  assert.match(accessFormSource, /Download publication/);
  assert.match(accessFormSource, /result\.accessGranted/);
  assert.match(accessFormSource, /result\.downloadUrl/);
});

test("publication email validation is provider-neutral", () => {
  assert.match(validationSource, /\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$/);
  assert.match(accessFormSource, /type="email"/);
  assert.doesNotMatch(
    `${validationSource}\n${accessFormSource}`,
    /gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com/i,
  );
});

test("verification email remains an optional server handoff", () => {
  assert.match(accessSource, /publicSiteUrl\(`\/api\/publications\/verify\?token=/);
  assert.doesNotMatch(accessSource, /publicSiteUrl\(`\/publications\/verify\?token=/);
  assert.match(accessSource, /This verification link expires in 30 minutes/);
  assert.match(accessSource, /NETWORK_RATE#/);
  assert.match(accessSource, /RECIPIENT_RATE#/);
  assert.match(accessSource, /canonicalSlug}:\$\{requestId\}/);
  assert.match(accessSource, /enforceVerificationRateLimit/);
});

test("publication event throttling distinguishes limits from service failures", () => {
  assert.match(eventRoute, /ConditionalCheckFailedException/);
  assert.match(eventRoute, /status: 429/);
  assert.match(eventRoute, /"Retry-After": "3600"/);
  assert.match(eventRoute, /publication-event-rate-limit-failed/);
  assert.match(eventRoute, /status: 503/);
});

test("the production gate verifies the complete publication throttle contract", () => {
  assert.match(deployWorkflow, /same_origin_headers=\$\(mktemp\)/);
  assert.match(deployWorkflow, /same_origin_body=\$\(mktemp\)/);
  assert.match(deployWorkflow, /retry-after:\[\[:space:\]\]\*3600/);
  assert.match(deployWorkflow, /content-type:\[\[:space:\]\]\*application\/json/);
  assert.match(
    deployWorkflow,
    /\.accepted == false and keys == \["accepted"\]/,
  );
});

test("production deployment proves a form-issued session reaches a signed private download", () => {
  assert.match(deployWorkflow, /aws amplify get-branch/);
  assert.match(deployWorkflow, /aws amplify update-branch/);
  assert.match(deployWorkflow, /PUBLICATION_HASH_SALT_SECRET_ARN/);
  assert.match(deployWorkflow, /infrastructure\/amplify\/public-site\.yml/);
  assert.match(deployWorkflow, /success@simulator\.amazonses\.com/);
  assert.match(deployWorkflow, /\.accessGranted == true/);
  assert.match(deployWorkflow, /__Host-srh_publication_access=/);
  assert.match(deployWorkflow, /authorized_download_status/);
  assert.match(deployWorkflow, /test "\$authorized_download_status" = "307"/);
  assert.match(deployWorkflow, /X-Amz-\(Algorithm\|Signature\)/);
  assert.match(deployWorkflow, /Authorized publication download: 307/);
});

test("SES readiness is reported without gating secure publication access", () => {
  assert.match(deployWorkflow, /aws sesv2 get-account/);
  assert.match(deployWorkflow, /ProductionAccessEnabled/);
  assert.match(deployWorkflow, /aws sesv2 put-account-details/);
  assert.match(deployWorkflow, /--mail-type TRANSACTIONAL/);
  assert.match(deployWorkflow, /--production-access-enabled/);
  assert.match(deployWorkflow, /ses_delivery_ready=false/);
  assert.match(deployWorkflow, /::warning::Amazon SES verification delivery is not production-ready/);
  assert.match(deployWorkflow, /Secure publication access remains available without email verification/);
  assert.doesNotMatch(deployWorkflow, /refusing to release public verification email delivery/);
  const statement = deploymentPolicy.Statement.find(
    ({ Sid }) => Sid === "RequestSesProductionAccess",
  );
  assert.ok(statement);
  assert.deepEqual(statement.Action, ["ses:GetAccount", "ses:PutAccountDetails"]);
});

test("publication infrastructure checks only the configuration needed at each stage", () => {
  assert.match(accessSource, /function requireHashingConfig\(\)/);
  assert.match(accessSource, /function requireRequestConfig\(\)/);
  assert.match(accessSource, /function requireDownloadConfig\(\)/);
  assert.match(accessSource, /const \{ tableName \} = requireHashingConfig\(\);/);
  assert.match(accessSource, /const \{ tableName, emailFrom \} = requireRequestConfig\(\);/);
  assert.match(accessSource, /const \{ bucketName \} = requireDownloadConfig\(\);/);
});

test("public application source contains no Google Drive publication URL", () => {
  const driveUrl = /(?:https?:)?\/\/(?:drive\.google\.com|docs\.google\.com|[^\s"']*googleusercontent\.com)/i;
  const internalDisclosure = /private\s+publication\s+store|google\s+drive/i;

  for (const path of sourceFiles(appRoot)) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, driveUrl, path);
    assert.doesNotMatch(source, internalDisclosure, path);
  }
});
