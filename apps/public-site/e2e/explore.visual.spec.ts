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

for (const place of places) {
  test(`${place.name} renders the Brief, Map and Action views without viewport overflow`, async ({ page }, testInfo) => {
    await page.goto(`/explore?kind=county&geoid=${place.geoid}&view=brief`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(place.name.split(",")[0], "i") })).toBeVisible();

    const brief = page.getByRole("tab", { name: "Brief" });
    const map = page.getByRole("tab", { name: "Map" });
    const action = page.getByRole("tab", { name: "Action" });
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
    await expect(page.getByText("No recommendation yet")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${place.geoid}-action.png`), fullPage: true });

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
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
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
