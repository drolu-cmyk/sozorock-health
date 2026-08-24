import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "@playwright/test";

const [mode, baseUrl, evidenceDirectoryInput] = process.argv.slice(2);
if (!["capture", "compare"].includes(mode) || !baseUrl || !evidenceDirectoryInput) {
  throw new Error(
    "Usage: node run-non-explore-regression.mjs <capture|compare> <base-url> <evidence-directory>",
  );
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const evidenceDirectory = path.resolve(repositoryRoot, evidenceDirectoryInput);

const routes = [
  "/",
  "/es",
  "/contact",
  "/publications",
  "/privacy",
  "/terms",
  "/accessibility",
  "/nondiscrimination",
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const defaultAllowedChangedPixelRatio = 0.0005;
// Publication covers are now served as their trusted source assets rather than
// being re-encoded by Next's Sharp-backed optimizer. Keep a narrowly bounded
// tolerance for codec-level antialiasing while retaining the stricter default
// for every other public route.
const routePixelRatioLimits = new Map([["/publications", 0.003]]);
const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

function keyFor(route, viewport) {
  const routeKey = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
  return `${routeKey}-${viewport.name}`;
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

const browser = await chromium.launch();
const manifest = {
  schema: "sozorock.non-explore-regression.v1",
  capturedAt: new Date().toISOString(),
  baseUrl: normalizedBaseUrl,
  pages: {},
};
const differences = [];

try {
  await mkdir(evidenceDirectory, { recursive: true });
  for (const route of routes) {
    for (const viewport of viewports) {
      const key = keyFor(route, viewport);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      const response = await page.goto(`${normalizedBaseUrl}${route}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      if (!response?.ok()) {
        throw new Error(`${route} returned ${response?.status() ?? "no response"}.`);
      }
      await page.evaluate(() => document.fonts?.ready);
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
      });
      const text = normalizeText(await page.locator("body").innerText());
      const screenshot = await page.screenshot({
        fullPage: true,
        animations: "disabled",
      });
      const screenshotName = `${key}.png`;
      const textName = `${key}.txt`;
      const screenshotPath = path.join(evidenceDirectory, screenshotName);
      const textPath = path.join(evidenceDirectory, textName);

      if (mode === "capture") {
        await writeFile(screenshotPath, screenshot);
        await writeFile(textPath, `${text}\n`, "utf8");
      } else {
        const baselineText = normalizeText(await readFile(textPath, "utf8"));
        if (baselineText !== text) {
          differences.push({ key, kind: "rendered_text" });
        }
        const baseline = PNG.sync.read(await readFile(screenshotPath));
        const candidate = PNG.sync.read(screenshot);
        if (
          baseline.width !== candidate.width ||
          baseline.height !== candidate.height
        ) {
          differences.push({
            key,
            kind: "dimensions",
            baseline: `${baseline.width}x${baseline.height}`,
            candidate: `${candidate.width}x${candidate.height}`,
          });
        } else {
          const diff = new PNG({ width: baseline.width, height: baseline.height });
          const changedPixels = pixelmatch(
            baseline.data,
            candidate.data,
            diff.data,
            baseline.width,
            baseline.height,
            { threshold: 0.1 },
          );
          const changedPixelRatio =
            changedPixels / (baseline.width * baseline.height);
          const allowedChangedPixelRatio =
            routePixelRatioLimits.get(route) ?? defaultAllowedChangedPixelRatio;
          if (changedPixelRatio > allowedChangedPixelRatio) {
            const diffName = `${key}.diff.png`;
            await writeFile(path.join(evidenceDirectory, diffName), PNG.sync.write(diff));
            differences.push({
              key,
              kind: "visual",
              changedPixels,
              changedPixelRatio,
              diff: diffName,
            });
          }
        }
      }

      manifest.pages[key] = {
        route,
        viewport,
        status: response.status(),
        title: await page.title(),
        renderedTextSha256: createHash("sha256").update(text).digest("hex"),
        screenshot: screenshotName,
        consoleErrors,
      };
      if (consoleErrors.length) {
        differences.push({ key, kind: "console", consoleErrors });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

manifest.differences = differences;
await writeFile(
  path.join(evidenceDirectory, `${mode}-manifest.json`),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
if (differences.length) {
  throw new Error(
    `Non-Explore regression failed:\n${JSON.stringify(differences, null, 2)}`,
  );
}
console.log(
  `Non-Explore ${mode} passed for ${routes.length} routes at ${viewports.length} viewports.`,
);
