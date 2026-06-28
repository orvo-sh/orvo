import { expect, test } from "@playwright/test";

import {
  buildLog,
  createLogsTestApp,
  openLogsPage,
  seedLogsForApp,
} from "./helpers";

test.use({ storageState: "tests/.auth/full-user.json" });

test("infinite scroll appends the next page of logs", async ({ page }) => {
  const app = await createLogsTestApp();
  const now = Date.now();

  await seedLogsForApp(
    app.id,
    Array.from({ length: 275 }, (_, index) =>
      buildLog({
        id: `log_${String(index).padStart(3, "0")}`,
        timestamp: new Date(now - index * 1_000).toISOString(),
        body: `Paginated log ${String(index).padStart(3, "0")}`,
      }),
    ),
  );

  await openLogsPage(page, app.id);

  await expect(page.getByTestId("logs-table-row")).toHaveCount(250);

  await page.getByTestId("logs-table-scroll-viewport").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(page.getByTestId("logs-table-row")).toHaveCount(275);
  await expect(page.getByText("Paginated log 274")).toBeVisible();
});
