import { expect, test } from "@playwright/test";

const cases = [
  { key: "albany", name: "Albany County, New York", expectedFit: "insufficient evidence" },
  { key: "bexar", name: "Bexar County, Texas", expectedFit: "requires local partner review" },
] as const;

for (const value of cases) {
  test(`${value.name} renders a responsive public preview and protected internal detail`, async ({ page, request }, testInfo) => {
    await page.goto(`/review/partner-evidence?place=${value.key}&mode=public`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "A case for action—without inventing one." })).toBeVisible();
    await expect(page.getByText("Review only").first()).toBeVisible();
    await expect(page.getByText("Not approved for public distribution.")).toBeVisible();
    await expect(page.getByText(value.name).first()).toBeVisible();
    await expect(page.getByText(value.expectedFit, { exact: true })).toBeVisible();
    await expect(page.getByText("Read the direction before the number.")).toBeVisible();
    await expect(page.getByText("Every visible claim keeps its dates and scope.")).toBeVisible();
    await expect(page.getByText("Claims awaiting a human decision")).toHaveCount(0);

    const download = page.getByRole("link", { name: /Download evidence brief/ });
    await expect(download).toBeVisible();
    const response = await request.get(await download.getAttribute("href") ?? "");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect((await response.body()).byteLength).toBeGreaterThan(50_000);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`${value.key}-public.png`), fullPage: true });

    await page.getByRole("link", { name: "Internal detail" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "What reviewers still need to decide." })).toBeVisible();
    await expect(page.getByText("Provisional").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${value.key}-internal.png`), fullPage: true });
  });
}
