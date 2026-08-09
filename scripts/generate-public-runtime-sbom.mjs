import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtimeRoot = path.join(root, "apps", "public-site", ".next");
const outputPath =
  process.env.PUBLIC_RUNTIME_SBOM ??
  path.join(root, "output", "security", "public-runtime.cdx.json");

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
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function npmPurl(name, version) {
  const encodedName = name.startsWith("@")
    ? `%40${name.slice(1).split("/").map(encodeURIComponent).join("/")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

if (!(await exists(runtimeRoot))) {
  throw new Error("Public production build is missing.");
}

const runtimeFiles = await walk(runtimeRoot);
const traceFiles = runtimeFiles.filter((file) => file.endsWith(".nft.json"));
if (traceFiles.length === 0) throw new Error("No Next.js runtime traces were found.");

const packageFiles = new Set();
for (const traceFile of traceFiles) {
  const trace = JSON.parse(await readFile(traceFile, "utf8"));
  for (const entry of Array.isArray(trace.files) ? trace.files : []) {
    if (!String(entry).replaceAll("\\", "/").endsWith("/package.json")) continue;
    const resolved = path.resolve(path.dirname(traceFile), String(entry));
    if (await exists(resolved)) packageFiles.add(resolved);
  }
}

const componentsByIdentity = new Map();
for (const packageFile of packageFiles) {
  const bytes = await readFile(packageFile);
  const packageJson = JSON.parse(bytes.toString("utf8"));
  if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") {
    continue;
  }
  const identity = `${packageJson.name}@${packageJson.version}`;
  const component = {
    type: "library",
    name: packageJson.name,
    version: packageJson.version,
    purl: npmPurl(packageJson.name, packageJson.version),
    hashes: [
      {
        alg: "SHA-256",
        content: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
    properties: [
      {
        name: "sozorock:runtime-trace",
        value: "nextjs-nft",
      },
    ],
  };
  const existing = componentsByIdentity.get(identity);
  if (existing && existing.hashes[0].content !== component.hashes[0].content) {
    throw new Error(`Conflicting traced package metadata for ${identity}.`);
  }
  componentsByIdentity.set(identity, component);
}

const components = [...componentsByIdentity.values()].sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
);
const forbiddenRuntimeComponents = components.filter(({ name }) =>
  /^(?:sharp|postcss|libvips|@img\/sharp-)/i.test(name),
);
if (forbiddenRuntimeComponents.length > 0) {
  throw new Error(
    `Build-only or vulnerable packages entered the runtime SBOM: ${forbiddenRuntimeComponents
      .map(({ name, version }) => `${name}@${version}`)
      .join(", ")}`,
  );
}

const appPackage = JSON.parse(
  await readFile(path.join(root, "apps", "public-site", "package.json"), "utf8"),
);
const componentHash = createHash("sha256")
  .update(JSON.stringify(components))
  .digest("hex");
const serial = [
  componentHash.slice(0, 8),
  componentHash.slice(8, 12),
  `4${componentHash.slice(13, 16)}`,
  `8${componentHash.slice(17, 20)}`,
  componentHash.slice(20, 32),
].join("-");
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${serial}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: {
      components: [
        {
          type: "application",
          name: "sozorock-public-runtime-sbom",
          version: "1",
        },
      ],
    },
    component: {
      type: "application",
      name: appPackage.name,
      version: appPackage.version,
      properties: [
        { name: "sozorock:trace-count", value: String(traceFiles.length) },
        { name: "sozorock:component-set-sha256", value: componentHash },
      ],
    },
  },
  components,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
console.log(
  `Public runtime SBOM contains ${components.length} traced package components (${componentHash}).`,
);
