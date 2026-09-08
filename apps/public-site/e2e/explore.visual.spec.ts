import { expect, test } from "@playwright/test";
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

test("invalid geography is rejected without masquerading as a service outage", async ({ request }) => {
  for (const endpoint of ["/api/explore", "/api/evidence/v1/place-brief"]) {
  for (const [query, status] of [["kind=county&geoid=invalid", 400], ["kind=invalid&geoid=36001", 400], ["kind=county&geoid=99999", 404]] as const) {
    const response = await request.get(`${endpoint}?${query}`);
    expect(response.status()).toBe(status);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  }
});

test("deep links preserve the selected view and measure and the download dialog returns focus", async ({ page }) => {
  await page.goto("/explore?kind=county&geoid=36001&view=map&measure=diabetes");
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Compatible data layer")).toHaveValue("diabetes");
  await page.getByLabel("Compatible data layer").selectOption("obesity");
  await expect(page).toHaveURL(/measure=obesity/);
  await page.reload();
  await expect(page.getByLabel("Compatible data layer")).toHaveValue("obesity");
  const download = page.getByRole("button", { name: "Download", exact: true });
  await download.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Download place brief", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(download).toBeFocused();
});

test("evidence failure has an actionable retry without invented county data", async ({ page }) => {
  await page.route("**/api/explore?*", (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "The evidence source is temporarily unavailable." }),
  }));
  await page.goto("/explore?kind=county&geoid=36001&view=brief");
  await expect(page.getByRole("heading", { name: "County evidence is unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await page.unroute("**/api/explore?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Albany County, NY" })).toBeVisible();
});

test("map failure preserves an accessible county measure", async ({ page }) => {
  await page.route("**/api/explore/geometry?*", (route) => route.fulfill({status:503,body:"{}",contentType:"application/json"}));
  await page.goto("/explore?kind=county&geoid=36001&view=map&measure=diabetes");
  await expect(page.getByText("The official boundary is temporarily unavailable.")).toBeVisible();
  await expect(page.getByLabel("Compatible data layer")).toHaveValue("diabetes");
  await page.getByRole("tab", {name:"Brief",exact:true}).click();
  await expect(page.getByRole("heading", {name:"What is known about this place"})).toBeVisible();
});

test("enabled evidence and download actions meet text contrast requirements", async ({ page }) => {
  await page.goto("/explore?kind=county&geoid=36001&view=brief");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const contrast = async (name: string) => page.getByRole("button", { name, exact: true }).evaluate(element => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(await contrast("Download place brief")).toBeGreaterThanOrEqual(4.5);
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Action", exact: true }).click();
  await page.getByLabel("Question about Albany County, NY").fill("What do these county measures mean?");
  await expect(page.getByRole("button", { name: "Ask Place Intelligence", exact: true })).toBeEnabled();
  expect(await contrast("Ask Place Intelligence")).toBeGreaterThanOrEqual(4.5);
});

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
    await expect(page.getByText("No recommendation yet")).toBeVisible();
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
