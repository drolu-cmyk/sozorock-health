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
});

test("publication access state changes are atomic and supported by least privilege IAM", () => {
  assert.match(accessSource, /TransactWriteCommand/);
  assert.match(accessSource, /TransactItems:/);
  assert.match(accessSource, /attribute_not_exists\(consumedAt\) AND expiresAt >= :epoch/);
  assert.match(publicationInfrastructure, /dynamodb:TransactWriteItems/);
  assert.match(publicationInfrastructure, /Resource: !GetAtt PublicationAccessTable\.Arn/);
});

test("verification email enters through the server handoff route", () => {
  assert.match(accessSource, /\/api\/publications\/verify\?token=/);
  assert.doesNotMatch(accessSource, /\/publications\/verify\?token=/);
  assert.match(accessSource, /This link expires in 30 minutes/);
});

test("public application source contains no Google Drive publication URL", () => {
  const driveUrl = /(?:https?:)?\/\/(?:drive\.google\.com|docs\.google\.com|[^\s"']*googleusercontent\.com)/i;

  for (const path of sourceFiles(appRoot)) {
    assert.doesNotMatch(readFileSync(path, "utf8"), driveUrl, path);
  }
});
