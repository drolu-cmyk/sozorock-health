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

test("verification email enters through the server handoff route", () => {
  assert.match(accessSource, /publicSiteUrl\(`\/api\/publications\/verify\?token=/);
  assert.doesNotMatch(accessSource, /publicSiteUrl\(`\/publications\/verify\?token=/);
  assert.match(accessSource, /This link expires in 30 minutes/);
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

test("public application source contains no Google Drive publication URL", () => {
  const driveUrl = /(?:https?:)?\/\/(?:drive\.google\.com|docs\.google\.com|[^\s"']*googleusercontent\.com)/i;
  const internalDisclosure = /private\s+publication\s+store|google\s+drive/i;

  for (const path of sourceFiles(appRoot)) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, driveUrl, path);
    assert.doesNotMatch(source, internalDisclosure, path);
  }
});
