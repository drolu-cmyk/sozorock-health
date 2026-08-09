import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportPath =
  process.env.PUBLIC_SOURCE_ADVISORY_REPORT ??
  path.join(root, "output", "security", "public-source-advisories.json");
const runtimeReportPath =
  process.env.PUBLIC_RUNTIME_SECURITY_REPORT ??
  path.join(root, "output", "security", "public-runtime-security.json");

const expectedNextVersion = "15.5.21";
const expectedVendoredPostcssVersion = "8.4.31";
const permittedAdvisoryUrls = new Set([
  "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
  "https://github.com/advisories/GHSA-6g55-p6wh-862q",
  "https://github.com/advisories/GHSA-r28c-9q8g-f849",
  "https://github.com/advisories/GHSA-fxqj-rqcc-2cmp",
]);

function fail(message) {
  throw new Error(`Public source-advisory policy failed: ${message}`);
}

async function readPackageVersion(relativePath) {
  const packageJson = JSON.parse(
    await readFile(path.join(root, relativePath), "utf8"),
  );
  return packageJson.version;
}

const npmArguments = [
  "audit",
  "--workspace",
  "@sozorock/public-site",
  "--omit=dev",
  "--omit=optional",
  "--json",
];
const command =
  process.platform === "win32"
    ? [
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", `npm ${npmArguments.join(" ")}`],
      ]
    : ["npm", npmArguments];
const auditResult = spawnSync(command[0], command[1], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
  maxBuffer: 16 * 1024 * 1024,
});

if (auditResult.error) fail(auditResult.error.message);
if (!auditResult.stdout) fail(auditResult.stderr || "npm audit returned no JSON");

let audit;
try {
  audit = JSON.parse(auditResult.stdout);
} catch {
  fail(`npm audit returned invalid JSON: ${auditResult.stderr || "no detail"}`);
}
if (audit.error) fail(audit.error.summary || audit.error.detail || "npm audit failed");
if (![0, 1].includes(auditResult.status ?? -1)) {
  fail(`npm audit exited ${auditResult.status}: ${auditResult.stderr}`);
}

const nextVersion = await readPackageVersion("node_modules/next/package.json");
if (nextVersion !== expectedNextVersion) {
  fail(`expected Next.js ${expectedNextVersion}, found ${nextVersion}`);
}

const vulnerabilities = audit.vulnerabilities ?? {};
const vulnerabilityNames = Object.keys(vulnerabilities).sort();
const cleanAudit = vulnerabilityNames.length === 0;
let vendoredPostcssVersion = null;
let advisoryUrls = [];

if (!cleanAudit) {
  if (JSON.stringify(vulnerabilityNames) !== JSON.stringify(["next", "postcss"])) {
    fail(`unexpected vulnerability set: ${vulnerabilityNames.join(", ")}`);
  }

  const nextFinding = vulnerabilities.next;
  const postcssFinding = vulnerabilities.postcss;
  if (
    nextFinding?.severity !== "moderate" ||
    JSON.stringify(nextFinding.via) !== JSON.stringify(["postcss"]) ||
    JSON.stringify(nextFinding.nodes) !== JSON.stringify(["node_modules/next"])
  ) {
    fail("Next.js finding no longer matches the reviewed build-only dependency chain");
  }
  if (
    postcssFinding?.severity !== "high" ||
    JSON.stringify(postcssFinding.nodes) !==
      JSON.stringify(["node_modules/next/node_modules/postcss"])
  ) {
    fail("PostCSS finding no longer matches the reviewed vendored build dependency");
  }

  const detailedFindings = Array.isArray(postcssFinding.via)
    ? postcssFinding.via.filter((finding) => typeof finding === "object")
    : [];
  advisoryUrls = detailedFindings.map((finding) => finding.url).sort();
  const expectedUrls = [...permittedAdvisoryUrls].sort();
  if (JSON.stringify(advisoryUrls) !== JSON.stringify(expectedUrls)) {
    fail(`advisory set changed: ${advisoryUrls.join(", ")}`);
  }

  vendoredPostcssVersion = await readPackageVersion(
    "node_modules/next/node_modules/postcss/package.json",
  );
  if (vendoredPostcssVersion !== expectedVendoredPostcssVersion) {
    fail(
      `expected reviewed vendored PostCSS ${expectedVendoredPostcssVersion}, found ${vendoredPostcssVersion}`,
    );
  }
}

const runtimeReport = JSON.parse(await readFile(runtimeReportPath, "utf8"));
if (
  runtimeReport.sharpPresentInRuntimeArtifact !== false ||
  runtimeReport.libvipsPresent !== false ||
  runtimeReport.postcssPresentInRuntimeArtifact !== false ||
  runtimeReport.runtimeTraceImportsSharp !== false ||
  runtimeReport.runtimeTraceImportsPostcss !== false
) {
  fail("runtime artifact report does not prove Sharp, libvips and PostCSS are absent");
}

const report = {
  schema: "sozorock.public-source-advisories.v1",
  generatedAt: new Date().toISOString(),
  npmAuditExitCode: auditResult.status,
  sourceDependencyAuditClean: cleanAudit,
  nextVersion,
  vendoredPostcssVersion,
  permittedBuildOnlyAdvisories: advisoryUrls,
  classification: cleanAudit
    ? "source_dependency_audit_clean"
    : "reviewed_next_build_dependency_absent_from_runtime",
  productionRuntime: {
    artifactSha256: runtimeReport.artifactSha256,
    sharpPresent: false,
    libvipsPresent: false,
    postcssPresent: false,
    highOrCriticalVulnerabilityGate: "requires_trivy_runtime_sbom_pass",
  },
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  cleanAudit
    ? "Public source dependency audit is clean."
    : `Reviewed Next.js build-only advisory chain is absent from runtime artifact ${runtimeReport.artifactSha256}.`,
);
