import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

test("actual MVP usage report for screenshot redaction", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "截圖去識別化" })).toBeVisible();
  await page.getByRole("button", { name: "開發者" }).click();
  await page.getByRole("button", { name: "跑樣本" }).click();

  const crmReport = {
    sample: "crm",
    recognitionSuccessRate: await page.getByTestId("recognition-rate").innerText(),
    redactionSuccessRate: await page.getByTestId("redaction-rate").innerText(),
    precision: await page.getByTestId("precision-rate").innerText(),
    ocrBoxes: await page.locator(".detection-list article").filter({ hasText: "OCR ·" }).count(),
    redactions: await page.locator(".detection-list article").filter({ hasText: "已遮蔽" }).count()
  };

  await expect(page.getByTestId("recognition-rate")).toHaveText("93%");
  await expect(page.getByTestId("redaction-rate")).toHaveText("100%");
  await expect(page.getByTestId("precision-rate")).toHaveText("100%");
  await expect(page.getByText("uncertainty:ocr-confusion-phone")).toBeVisible();
  await page.getByTestId("result-canvas").screenshot({ path: "test-results/crm-redacted.png" });

  await page.getByRole("button", { name: "帳號設定截圖" }).click();
  await page.getByRole("button", { name: "跑樣本" }).click();

  const settingsReport = {
    sample: "settings",
    recognitionSuccessRate: await page.getByTestId("recognition-rate").innerText(),
    redactionSuccessRate: await page.getByTestId("redaction-rate").innerText(),
    precision: await page.getByTestId("precision-rate").innerText(),
    ocrBoxes: await page.locator(".detection-list article").filter({ hasText: "OCR ·" }).count(),
    redactions: await page.locator(".detection-list article").filter({ hasText: "已遮蔽" }).count()
  };

  await expect(page.getByTestId("recognition-rate")).toHaveText("100%");
  await expect(page.getByTestId("redaction-rate")).toHaveText("100%");
  await expect(page.getByTestId("precision-rate")).toHaveText("100%");
  await page.getByTestId("result-canvas").screenshot({ path: "test-results/settings-redacted.png" });

  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile(
    path.join("test-results", "mvp-usage-report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), reports: [crmReport, settingsReport] }, null, 2)
  );
});
