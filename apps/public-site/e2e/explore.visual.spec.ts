import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const nationalReport = JSON.parse(
  readFileSync(
    new URL(
      "../../../packages/evidence-core/data/national/national-coverage-report.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  randomStateSample: Array<{ state: string; geoid: string; name: string }>;
};

const places = [
  { name: "Albany County, NY", geoid: "36001" },
  { name: "Schenectady County, NY", geoid: "36093" },
  { name: "Montgomery County, NY", geoid: "36057" },
  { name: "Chester County, PA", geoid: "42029" },
  { name: "Bexar County, TX", geoid: "48029" },
] as const;

const releaseRegressionPlaces = [
  { name: "Cook County", geoid: "17031" },
  { name: "San Francisco County", geoid: "06075" },
  { name: "Yellowstone County", geoid: "30111" },
  { name: "Anchorage Municipality", geoid: "02020" },
  { name: "Richmond city", geoid: "51760" },
  { name: "District of Columbia", geoid: "11001" },
  { name: "Providence County", geoid: "44007" },
] as const;

for (const place of places) {
  test(`${place.name} renders Brief, Map, Action and Visuals without viewport overflow`, async ({ page }, testInfo) => {
    await page.goto(`/explore?kind=county&geoid=${place.geoid}&view=brief`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(place.name.split(",")[0], "i") })).toBeVisible();

    const brief = page.getByRole("tab", { name: "Brief" });
    const map = page.getByRole("tab", { name: "Map" });
    const action = page.getByRole("tab", { name: "Action" });
    const visuals = page.getByRole("tab", { name: "Visuals" });
    await expect(brief).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("What the local plan says")).toBeVisible();
    await expect(page.getByText(/Not yet verified|No current local plan is verified/).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${place.geoid}-brief.png`), fullPage: true });

    await brief.focus();
    await page.keyboard.press("ArrowRight");
    await expect(map).toHaveAttribute("aria-selected", "true");
    await expect(map).toBeFocused();
    await expect(page.getByText(/The shaded value applies to the selected geography as a whole/)).toBeVisible();
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${place.geoid}-map.png`), fullPage: true });

    await action.click();
    await expect(action).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel(`Question about ${place.name}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask Place Intelligence" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "No recommendation yet" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${place.geoid}-action.png`), fullPage: true });

    await visuals.click();
    await expect(visuals).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "See the measure. See its limits." })).toBeVisible();
    await expect(page.getByText("No fixed scores. No automatic recommendation.")).toBeVisible();
    await expect(page.getByText("All available measures")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${place.geoid}-visuals.png`), fullPage: true });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("required responsive widths preserve the county brief, map, and keyboard flow", async ({ page }) => {
  test.setTimeout(240_000);
  const widths = [320, 375, 390, 414, 768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/explore?kind=county&geoid=36001&view=brief", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { level: 1, name: /Albany County/i })).toBeVisible();
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await page.getByRole("tab", { name: "Visuals" }).click();
    await expect(page.getByRole("heading", { name: "See the measure. See its limits." })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test("cached boundary fallback preserves Fairfax holes and renders the original search geography", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const disabledWebglContext = function getContext(this: HTMLCanvasElement, type: string) {
      if (type === "webgl" || type === "webgl2") return null;
      return originalGetContext.call(this, type);
    } as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = disabledWebglContext;
  });
  await page.goto("/explore?kind=county&geoid=51059&view=brief", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByRole("tab", { name: "Map" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-map-fallback="true"]')).toBeVisible();
  await expect(page.locator('[data-map-fallback="true"] path[fill-rule="evenodd"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("fairfax-cached-boundary-fallback.png"), fullPage: true });
});

test("one stratified county from every state and DC resolves through the public interface", async ({ page }) => {
  test.setTimeout(360_000);
  expect(nationalReport.randomStateSample).toHaveLength(51);
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const sample of nationalReport.randomStateSample) {
    const response = await page.goto(
      `/explore?kind=county&geoid=${sample.geoid}&view=brief`,
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status(), `${sample.state} ${sample.geoid}`).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(sample.name, "i") }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${sample.state} ${sample.geoid}`).toBeLessThanOrEqual(1);
  }
});

test("release regression counties render a source-backed population or an explicit unavailable state", async ({ page }) => {
  test.setTimeout(180_000);
  for (const place of releaseRegressionPlaces) {
    const response = await page.goto(`/explore?kind=county&geoid=${place.geoid}&view=brief`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), place.geoid).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(place.name, "i") })).toBeVisible();
    await expect(page.getByText(/^0 people$/)).toHaveCount(0);
    await expect(page.getByText(/(?:[1-9][\d,]* people|Population unavailable)/).first()).toBeVisible();
  }
});

test("ZIP and multi-county place searches preserve the original input and require transparent county selection", async ({ page }) => {
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const search = page.getByRole("combobox", { name: "ZIP Code, city or county" });
  await search.fill("19104");
  await expect(search).toHaveValue("19104");
  const zipOption = page.getByRole("option", { name: /19104.*ZIP Code/i }).first();
  await expect(zipOption).toBeVisible();
  await zipOption.click();
  await expect(page.getByRole("heading", { level: 1, name: /Philadelphia County/i })).toBeVisible();
  await expect(page.getByText(/Search resolved from (?:ZIP Code )?19104 to this county/i)).toBeVisible();

  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const citySearch = page.getByRole("combobox", { name: "ZIP Code, city or county" });
  await citySearch.fill("Kansas City, MO");
  await expect(citySearch).toHaveValue("Kansas City, MO");
  const cityOption = page.getByRole("option", { name: /Kansas City, MO.*City or place/i }).first();
  await expect(cityOption).toBeVisible();
  await expect(cityOption).not.toContainText("MO, MO");
  await cityOption.click();
  await expect(page.getByRole("heading", { level: 1, name: /Kansas City.*intersects more than one county/i })).toBeVisible();
  const countyChoices = page.locator("section").filter({ hasText: "County evidence selection" }).getByRole("button");
  expect(await countyChoices.count()).toBeGreaterThan(1);
  await expect(countyChoices.first()).toContainText(/overlap/i);
});

test("Voice Access records by explicit user action, confirms the transcript, and submits through the governed agent route", async ({ page }) => {
  const transcriptHash = `sha256:${"a".repeat(64)}`;
  let submittedAgentBody: Record<string, unknown> | null = null;
  await page.addInitScript(() => {
    const stream = { getTracks: () => [{ stop: () => undefined }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    class MockMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: MockMediaRecorder });
  });
  await page.route("**/api/evidence/v1/voice/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "explore.voice-transcript.v1",
        transcript: "What current workforce evidence is available for this county?",
        transcriptHash,
        retainedRawAudio: false,
      }),
    });
  });
  await page.route("**/api/evidence/v1/agent", async (route) => {
    submittedAgentBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: "explore.place-agent-answer.v1",
        answer: "Compatible workforce records are available; local interpretation still requires review.",
        status: "answered",
        citedEvidence: [{
          citationId: "coverage:hrsa:36001",
          claim: "HRSA workforce source coverage is available for this county.",
          evidenceType: "source_coverage",
          sourceName: "Health Resources and Services Administration",
          officialUrl: "https://data.hrsa.gov/",
          releaseDate: "2026-07-01",
          dataPeriodStart: "2026-01-01",
          dataPeriodEnd: "2026-06-30",
          geographicScope: "Albany County, New York (county GEOID 36001)",
        }],
        sourceAndDataDates: [],
        geographicScope: { kind: "county", geoid: "36001", displayName: "Albany County, NY" },
        confidence: "moderate",
        missingEvidence: [],
        caveats: ["Designation scope must be reviewed."],
        nonClinicalBoundary: "This is non-clinical county planning evidence, not medical advice.",
        visualIntent: {
          view: "visuals",
          measureKey: null,
          comparisonBasis: "unavailable",
          mapLayer: "source_coverage",
          rationale: "Show the workforce evidence coverage record and its scope.",
        },
      }),
    });
  });

  await page.goto("/explore?kind=county&geoid=36001&view=action", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Action" }).click();
  const voiceButton = page.getByRole("button", { name: "Ask with Voice Access" });
  await voiceButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  const question = page.getByLabel("Question about Albany County, NY");
  await expect(question).toHaveValue("What current workforce evidence is available for this county?");
  await expect(question).toBeFocused();
  await expect(page.getByText(/Review or correct the transcript/i)).toBeVisible();
  await page.getByRole("button", { name: "Ask Place Intelligence" }).click();
  const responseHeading = page.getByRole("heading", { name: "Place Intelligence response" });
  await expect(responseHeading.locator("..")).toBeFocused();
  await expect(page.getByText("Compatible workforce records are available; local interpretation still requires review.")).toBeVisible();
  await expect(page.getByText("Health Resources and Services Administration")).toBeVisible();
  expect(submittedAgentBody).toMatchObject({
    geoid: "36001",
    inputMode: "voice",
    transcriptHash,
  });
});

test("Voice Access denial preserves the typed planning path", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const error = new Error("Permission denied");
          error.name = "NotAllowedError";
          throw error;
        },
      },
    });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: class MockMediaRecorder {} });
  });
  await page.goto("/explore?kind=county&geoid=36001&view=action", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Action" }).click();
  await page.getByRole("button", { name: "Ask with Voice Access" }).click();
  await expect(page.getByText(/Microphone access was denied/)).toBeVisible();
  const question = page.getByLabel("Question about Albany County, NY");
  await question.fill("What evidence is still missing?");
  await expect(page.getByRole("button", { name: "Ask Place Intelligence" })).toBeEnabled();
});

test("Voice Access stops recording and releases the microphone when the Action view closes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __voiceRecorderStopped: false, __voiceTrackStopped: false });
    const stream = {
      getTracks: () => [{
        stop: () => { Object.assign(window, { __voiceTrackStopped: true }); },
      }],
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    class MockMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        Object.assign(window, { __voiceRecorderStopped: true });
        this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: MockMediaRecorder });
  });

  await page.goto("/explore?kind=county&geoid=36001&view=action", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Action" }).click();
  await page.getByRole("button", { name: "Ask with Voice Access" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.getByRole("tab", { name: "Map" }).click();
  await expect.poll(() => page.evaluate(() => ({
    recorder: Boolean((window as typeof window & { __voiceRecorderStopped?: boolean }).__voiceRecorderStopped),
    track: Boolean((window as typeof window & { __voiceTrackStopped?: boolean }).__voiceTrackStopped),
  }))).toEqual({ recorder: true, track: true });
  await expect(page.getByText("Preparing a transcript for your review.")).toHaveCount(0);
});

test("Brief, Map, Action and Visuals have no serious or critical WCAG violations", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/explore?kind=county&geoid=36001&view=brief", { waitUntil: "domcontentloaded" });
  for (const view of ["Brief", "Map", "Action", "Visuals"] as const) {
    await page.getByRole("tab", { name: view }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking, `${view}: ${blocking.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
  }
});
