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

if (!(await exists(runtimeRoot))) {
  throw new Error("Public production build is missing.");
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

const postcssPaths = files.filter((file) =>
  /(^|[\\/])node_modules[\\/](?:next[\\/]node_modules[\\/])?postcss([\\/]|$)/i.test(file),
);
if (postcssPaths.length) {
  throw new Error(
    `Build-only PostCSS exists in the runtime artifact:\n${postcssPaths.join("\n")}`,
  );
}

// Next.js may omit images-manifest.json when image optimization is fully
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
  const trace = JSON.parse(await readFile(file, "utf8"));
  const tracedFiles = Array.isArray(trace.files) ? trace.files : [];
  if (
    tracedFiles.some((entry) =>
      /(^|[\\/])sharp([\\/]|$)|libvips/i.test(String(entry)),
    )
  ) {
    throw new Error(`Runtime trace imports Sharp/libvips: ${file}`);
  }
  if (
    tracedFiles.some((entry) =>
      /(^|[\\/])node_modules[\\/](?:next[\\/]node_modules[\\/])?postcss([\\/]|$)/i.test(
        String(entry),
      ),
    )
  ) {
    throw new Error(`Runtime trace imports build-only PostCSS: ${file}`);
  }
}

const htmlFiles = files.filter((file) => file.endsWith(".html"));
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (html.includes("/_next/image")) {
    throw new Error(`Rendered HTML depends on /_next/image: ${file}`);
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
  schema: "sozorock.public-runtime-security.v1",
  generatedAt: new Date().toISOString(),
  runtimeRoot: "apps/public-site/.next",
  imageMode: "unoptimized",
  imagesManifestPresent,
  sharpPresentInRuntimeArtifact: false,
  libvipsPresent: false,
  postcssPresentInRuntimeArtifact: false,
  nextImageRouteRequiredByRenderedHtml: false,
  runtimeTraceImportsSharp: false,
  runtimeTraceImportsPostcss: false,
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
