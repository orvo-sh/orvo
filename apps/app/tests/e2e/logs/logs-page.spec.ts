import { expect, test } from "@playwright/test";

import {
  buildLog,
  createLogsTestApp,
  openLogsPage,
  seedLogsForApp,
} from "./helpers";

test.use({ storageState: "tests/.auth/full-user.json" });

test("logs page renders rows and opens the detail panel", async ({ page }) => {
  const app = await createLogsTestApp();
  await seedLogsForApp(app.id, [
    buildLog({
      id: "log_primary",
      timestamp: new Date(Date.now() - 60_000).toISOString(),
      body: "Primary seeded log",
      service_name: "api",
      log_attributes: {
        request_id: "req_123",
      },
    }),
  ]);

  await openLogsPage(page, app.id);

  await expect(page.getByText("Primary seeded log")).toBeVisible();
  await page.getByTestId("logs-table-row").first().click();

  await expect(page.getByTestId("log-detail-panel")).toBeVisible();
  await expect(page.getByText("Log attributes")).toBeVisible();
  await expect(page).toHaveURL(/log=log_primary/);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("log-detail-panel")).not.toBeVisible();
});

test("selected log deep links load detail data even when the row is not in the first page", async ({
  page,
}) => {
  const app = await createLogsTestApp();
  const targetId = "log_target";
  const now = Date.now();

  await seedLogsForApp(
    app.id,
    Array.from({ length: 255 }, (_, index) =>
      buildLog({
        id: index === 254 ? targetId : `log_${String(index).padStart(3, "0")}`,
        timestamp: new Date(now - index * 1_000).toISOString(),
        body:
          index === 254
            ? "Deep linked log body"
            : `Paged log ${String(index).padStart(3, "0")}`,
      }),
    ),
  );

  await openLogsPage(page, app.id, `?log=${targetId}`);

  await expect(page.getByTestId("log-detail-panel")).toBeVisible();
  await expect(page.getByText("Deep linked log body")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`log=${targetId}`));
});
