import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtimeRoot = path.join(root, "apps", "public-site", ".next");
const reportPath =
  process.env.PUBLIC_RUNTIME_SECURITY_REPORT ??
  path.join(root, "output", "security", "public-runtime-security.json");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(target)));
    } else if (entry.isFile()) {
      files.push(target);
    }
  }
  return files;
}

function renderedText(html) {
  const lower = html.toLowerCase();
  let output = "";
  let index = 0;
  let hiddenTag = null;

  while (index < html.length) {
    if (hiddenTag) {
      const marker = `</${hiddenTag}`;
      const closeStart = lower.indexOf(marker, index);
      if (closeStart < 0) break;
      const closeEnd = html.indexOf(">", closeStart + marker.length);
      if (closeEnd < 0) break;
      hiddenTag = null;
      index = closeEnd + 1;
      output += " ";
      continue;
    }

    if (html[index] !== "<") {
      output += html[index];
      index += 1;
      continue;
    }

    const tagEnd = html.indexOf(">", index + 1);
    if (tagEnd < 0) break;
    let cursor = index + 1;
    while (cursor < tagEnd && " \t\r\n".includes(html[cursor])) cursor += 1;
    const closing = html[cursor] === "/";
    if (closing) cursor += 1;
    while (cursor < tagEnd && " \t\r\n".includes(html[cursor])) cursor += 1;
    const nameStart = cursor;
    while (cursor < tagEnd) {
      const code = lower.charCodeAt(cursor);
      const isNameCharacter =
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57) ||
        code === 45;
      if (!isNameCharacter) break;
      cursor += 1;
    }
    const tagName = lower.slice(nameStart, cursor);
    if (!closing && (tagName === "script" || tagName === "style")) {
      hiddenTag = tagName;
    }
    index = tagEnd + 1;
    output += " ";
  }

  return output;
}

function wordTokens(value) {
  const tokens = [];
  let current = "";
  for (const character of value.toLowerCase()) {
    const code = character.charCodeAt(0);
    const isWordCharacter =
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 95;
    if (isWordCharacter) {
      current += character;
    } else if (current) {
      tokens.push(current);
      current = "";
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

if (!(await exists(runtimeRoot))) {
  throw new Error("Public production build is missing.");
}

const forbiddenInstallPaths = [
  path.join(root, "node_modules", "sharp"),
  path.join(root, "apps", "public-site", "node_modules", "sharp"),
];
for (const target of forbiddenInstallPaths) {
  if (await exists(target)) {
    throw new Error(`Sharp is installed in the production dependency tree: ${target}`);
  }
}

const files = await walk(runtimeRoot);
const forbiddenPaths = files.filter((file) =>
  /(^|[\\/])(sharp|libvips)([\\/]|[.-]|$)/i.test(file),
);
if (forbiddenPaths.length) {
  throw new Error(
    `Sharp/libvips exists in the runtime artifact:\n${forbiddenPaths.join("\n")}`,
  );
}

// Next.js 15 omits images-manifest.json when image optimization is fully
// disabled. When it is present, validate the artifact's explicit setting; when
// it is absent, validate the checked-in build configuration and the rendered
// artifact below. This keeps the check tied to the production build rather
// than requiring a file that Next does not emit for this supported mode.
const imagesManifestPath = path.join(runtimeRoot, "images-manifest.json");
const imagesManifestPresent = await exists(imagesManifestPath);
if (imagesManifestPresent) {
  const imagesManifest = JSON.parse(await readFile(imagesManifestPath, "utf8"));
  if (imagesManifest.images?.unoptimized !== true) {
    throw new Error("Next.js unoptimized image mode is not enabled.");
  }
} else {
  const nextConfig = await readFile(
    path.join(root, "apps", "public-site", "next.config.ts"),
    "utf8",
  );
  if (!/unoptimized:\s*true/.test(nextConfig)) {
    throw new Error("Next.js unoptimized image mode is not enabled.");
  }
}

const traceFiles = files.filter((file) => file.endsWith(".nft.json"));
for (const file of traceFiles) {
  const trace = await readFile(file, "utf8");
  if (/(^|[\\/"'])sharp([\\/"']|$)|libvips/i.test(trace)) {
    throw new Error(`Runtime trace imports Sharp/libvips: ${file}`);
  }
}

const htmlFiles = files.filter((file) => file.endsWith(".html"));
const forbiddenDisclosurePhrases = [
  ["private publication store", /private\s+publication\s+store/i],
  ["Google Drive publication delivery", /google\s+drive/i],
];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (html.includes("/_next/image")) {
    throw new Error(`Rendered HTML depends on /_next/image: ${file}`);
  }

  const visibleText = renderedText(html);
  for (const [label, pattern] of forbiddenDisclosurePhrases) {
    if (pattern.test(visibleText)) {
      throw new Error(`Rendered public copy contains ${label}: ${file}`);
    }
  }

  const tokens = wordTokens(visibleText);
  const tokenSet = new Set(tokens);
  for (const forbiddenWord of ["internal", "advisory", "slug", "localhost"]) {
    if (tokenSet.has(forbiddenWord)) {
      throw new Error(`Rendered public copy contains ${forbiddenWord}: ${file}`);
    }
  }
  for (let tokenIndex = 0; tokenIndex < tokens.length - 1; tokenIndex += 1) {
    if (tokens[tokenIndex] === "amplifyapp" && tokens[tokenIndex + 1] === "com") {
      throw new Error(`Rendered public copy contains an Amplify default domain: ${file}`);
    }
  }
}

const browserArtifactFiles = files.filter((file) => {
  const relative = path.relative(runtimeRoot, file).replaceAll("\\", "/");
  return (relative.startsWith("static/") || file.endsWith(".html"))
    && /\.(?:js|json|html|txt|map)$/i.test(file);
});
const secretSignatures = [
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  // Match a complete ARN token with explicit boundaries; do not accept an ARN-shaped substring inside a larger identifier.
  ["AWS resource identifier", /(?:^|[^A-Za-z0-9])arn:aws:[a-z0-9-]+:[^\s"'<]+(?=$|[^A-Za-z0-9])/i],
  ["AWS service endpoint", /\b(?:dynamodb|secretsmanager|s3)\.[a-z0-9-]+\.amazonaws\.com\b/i],
];
for (const file of browserArtifactFiles) {
  const text = await readFile(file, "utf8");
  for (const [label, pattern] of secretSignatures) {
    if (pattern.test(text)) {
      throw new Error(`Browser-delivered artifact contains a ${label} signature: ${file}`);
    }
  }
}

const manifestEntries = [];
for (const file of files) {
  const contents = await readFile(file);
  const metadata = await stat(file);
  manifestEntries.push({
    path: path.relative(runtimeRoot, file).replaceAll("\\", "/"),
    bytes: metadata.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}
manifestEntries.sort((a, b) => a.path.localeCompare(b.path));

const report = {
  schema: "sozorock.public-runtime-security.v2",
  generatedAt: new Date().toISOString(),
  runtimeRoot: "apps/public-site/.next",
  imageMode: "unoptimized",
  imagesManifestPresent,
  sharpInstalled: false,
  libvipsPresent: false,
  nextImageRouteRequiredByRenderedHtml: false,
  runtimeTraceImportsSharp: false,
  browserSecretSignaturesPresent: false,
  forbiddenRenderedCopyPresent: false,
  fileCount: manifestEntries.length,
  artifactSha256: createHash("sha256")
    .update(JSON.stringify(manifestEntries))
    .digest("hex"),
  files: manifestEntries,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `Public runtime verified: ${report.fileCount} files, artifact ${report.artifactSha256}`,
);
