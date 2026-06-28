import { expect, test } from "@playwright/test";

import {
  buildLog,
  createLogsTestApp,
  openLogsPage,
  seedLogsForApp,
} from "./helpers";

test.use({ storageState: "tests/.auth/full-user.json" });

test("clicking a chart bucket narrows the page to a time range", async ({ page }) => {
  const app = await createLogsTestApp();

  await seedLogsForApp(app.id, [
    buildLog({
      id: "older_log",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1_000).toISOString(),
      body: "Older chart log",
    }),
    buildLog({
      id: "newer_log",
      timestamp: new Date(Date.now() - 10 * 60 * 1_000).toISOString(),
      body: "Newer chart log",
    }),
  ]);

  await openLogsPage(page, app.id);

  const clickableBucket = page
    .locator('[data-testid="log-volume-bucket"][tabindex="0"]')
    .first();
  await clickableBucket.click();

  await expect(page).toHaveURL(/start=/);
  await expect(page).toHaveURL(/end=/);
  await expect(page).not.toHaveURL(/live=true/);
});
