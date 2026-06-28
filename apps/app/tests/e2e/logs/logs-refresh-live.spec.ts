import { expect, test } from "@playwright/test";

import {
  buildLog,
  createLogsTestApp,
  openLogsPage,
  seedLogsForApp,
} from "./helpers";

test.use({ storageState: "tests/.auth/full-user.json" });

test("manual refresh pulls in newly inserted logs", async ({ page }) => {
  const app = await createLogsTestApp();
  await seedLogsForApp(app.id, [
    buildLog({
      id: "initial_log",
      timestamp: new Date(Date.now() - 120_000).toISOString(),
      body: "Initial log entry",
    }),
  ]);

  await openLogsPage(page, app.id);
  await expect(page.getByText("Initial log entry")).toBeVisible();
  await expect(page.getByText("Fresh log entry")).not.toBeVisible();

  await seedLogsForApp(app.id, [
    buildLog({
      id: "fresh_log",
      timestamp: new Date().toISOString(),
      body: "Fresh log entry",
    }),
  ]);

  await page.getByRole("button", { name: "Refresh data" }).click();

  await expect(page.getByText("Fresh log entry")).toBeVisible();
});

test("live mode automatically refreshes and shows newly inserted logs", async ({
  page,
}) => {
  const app = await createLogsTestApp();
  await seedLogsForApp(app.id, [
    buildLog({
      id: "baseline_log",
      timestamp: new Date(Date.now() - 120_000).toISOString(),
      body: "Baseline log entry",
    }),
  ]);

  await openLogsPage(page, app.id);

  await page.getByRole("button", { name: "Live mode" }).click();
  await expect(page).toHaveURL(/live=true/);

  await seedLogsForApp(app.id, [
    buildLog({
      id: "live_log",
      timestamp: new Date().toISOString(),
      body: "Live log entry",
    }),
  ]);

  await expect(page.getByText("Live log entry")).toBeVisible({
    timeout: 12_000,
  });
});

test("live mode controls are disabled for explicit time ranges", async ({ page }) => {
  const app = await createLogsTestApp();

  await openLogsPage(
    page,
    app.id,
    "?start=2026-06-28T09:00:00.000Z&end=2026-06-28T10:00:00.000Z",
  );

  await expect(page.getByRole("button", { name: "Live mode" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Refresh data" })).toBeDisabled();
});
