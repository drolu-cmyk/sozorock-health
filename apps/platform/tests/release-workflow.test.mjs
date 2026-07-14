import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pins protected main and reads deployment inputs from the approved commit", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/deploy-cbcap.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /git diff --exit-code/);
  assert.match(workflow, /git status --porcelain --untracked-files=no/);
  assert.match(workflow, /git show HEAD:infrastructure\/amplify\/platform\.yml/);
  assert.match(workflow, /git ls-remote --exit-code "\$EXPECTED_REPOSITORY\.git" refs\/heads\/main/);
  assert.match(workflow, /origin_main_before/);
  assert.match(workflow, /origin_main_after/);
  assert.match(workflow, /deployed_commit" == "HEAD"/);
  assert.match(workflow, /\^\[0-9a-f\]\{7,40\}\$/);
  assert.match(workflow, /aws sts get-caller-identity/);
  assert.match(workflow, /delete-domain-association/);
  assert.match(workflow, /failed_verified_count/);
  assert.match(workflow, /failed_certificate_type/);
  assert.match(workflow, /create-domain-association/);
  assert.doesNotMatch(workflow, /update-domain-association/);
  assert.doesNotMatch(workflow, /allowed-account-ids/);
  assert.match(workflow, /Amplify reports the domain as AVAILABLE/);
  assert.match(workflow, /The live DNS and TLS proof remains authoritative/);
  assert.doesNotMatch(workflow, /test "\$verified" = "true"/);
  assert.match(workflow, /--tlsv1\.2/);
  assert.match(workflow, /effective_url/);
  assert.match(workflow, /strict-transport-security/);
  assert.match(workflow, /content-security-policy/);
  assert.match(workflow, /x-content-type-options/);
  assert.match(workflow, /redirect_status/);
  assert.match(workflow, /http:\/\/\$CBCAP_DOMAIN\//);
  assert.match(workflow, /\.coverage\.countyCount == 3144/);
  assert.match(workflow, /cbcap-county-map-2025\.json/);
  assert.match(workflow, /\(\.records \| length\) == 3144/);
  assert.match(workflow, /\[\.records\[\]\[0\]\] \| unique \| length/);
  assert.match(workflow, /\.sourceHash == \$expected/);
});

test("limits automated DNS changes to the exact CB-CAP name", async () => {
  const policy = JSON.parse(
    await readFile(
      new URL("../../../infrastructure/iam/github-cbcap-production-policy.json", import.meta.url),
      "utf8",
    ),
  );

  const dnsStatement = policy.Statement.find(
    (statement) => statement.Sid === "ReconcileOnlyCbcapDnsRecords",
  );

  assert.equal(dnsStatement.Resource, "arn:aws:route53:::hostedzone/Z07905293AANZWGYZ84F3");
  assert.deepEqual(
    dnsStatement.Condition["ForAllValues:StringLike"][
      "route53:ChangeResourceRecordSetsNormalizedRecordNames"
    ],
    ["cbcap.sozorockfoundation.org", "*.cbcap.sozorockfoundation.org"],
  );

  const domainStatement = policy.Statement.find(
    (statement) => statement.Sid === "ManageOnlyTheExactCbcapDomainAssociation",
  );
  assert.deepEqual(domainStatement.Action, [
    "amplify:CreateDomainAssociation",
    "amplify:DeleteDomainAssociation",
    "amplify:GetDomainAssociation",
  ]);
});
