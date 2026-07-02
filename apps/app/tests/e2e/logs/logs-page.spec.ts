import { expect, test, type Page } from "@playwright/test";

import {
  buildLog,
  createLogsTestApp,
  openLogsPage,
  seedLogsForApp,
} from "./helpers";

test.use({ storageState: "tests/.auth/full-user.json" });

const getFilterParams = (url: string) =>
  new URL(url).searchParams
    .getAll("filter")
    .map((value) => JSON.parse(value) as {
      attribute: string;
      operator: string;
      value: string;
    });

const applyServiceFilter = async (page: Page, value: string) => {
  const filterInput = page.getByTestId("logs-toolbar").locator("input");

  await filterInput.click();
  await filterInput.fill("service");
  await filterInput.press("Enter");
  await filterInput.press("Enter");
  await filterInput.fill(value);
  await filterInput.press("Enter");
};

const applyTimePreset = async (
  page: Page,
  presetLabel: string,
) => {
  await page.getByRole("button", { name: /Last 24 hours|Last hour|Today/i }).click();
  await page.getByRole("button", { name: presetLabel, exact: true }).click();
  await page.getByRole("button", { name: "Apply" }).click();
};

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

test("applying a service filter keeps the URL state and preserves newest-first ordering", async ({
  page,
}) => {
  const app = await createLogsTestApp();
  const now = Date.now();

  await seedLogsForApp(app.id, [
    buildLog({
      id: "worker_newest",
      timestamp: new Date(now - 10_000).toISOString(),
      body: "Newest worker log",
      service_name: "worker",
    }),
    buildLog({
      id: "api_newest",
      timestamp: new Date(now - 20_000).toISOString(),
      body: "Newest api log",
      service_name: "api",
    }),
    buildLog({
      id: "api_oldest",
      timestamp: new Date(now - 30_000).toISOString(),
      body: "Oldest api log",
      service_name: "api",
    }),
  ]);

  await openLogsPage(page, app.id);
  await applyServiceFilter(page, "api");

  await expect.poll(() => getFilterParams(page.url())).toEqual([
    {
      attribute: "service",
      operator: "eq",
      value: "api",
    },
  ]);

  await expect(page.getByText("Newest worker log")).not.toBeVisible();
  await expect(page.getByTestId("logs-table-row").nth(0)).toContainText("Newest api log");
  await expect(page.getByTestId("logs-table-row").nth(1)).toContainText("Oldest api log");

  await page.getByTestId("logs-table-row").first().click();

  await expect(page).toHaveURL(/log=api_newest/);
  await expect.poll(() => getFilterParams(page.url())).toEqual([
    {
      attribute: "service",
      operator: "eq",
      value: "api",
    },
  ]);
});

test("applying a time preset keeps it in the URL after selecting a log", async ({
  page,
}) => {
  const app = await createLogsTestApp();

  await seedLogsForApp(app.id, [
    buildLog({
      id: "today_log",
      timestamp: new Date().toISOString(),
      body: "Today log entry",
      service_name: "api",
    }),
  ]);

  await openLogsPage(page, app.id);
  await applyTimePreset(page, "Today");

  await expect(page).toHaveURL(/preset=today/);

  await page.getByTestId("logs-table-row").first().click();

  const searchParams = new URL(page.url()).searchParams;
  expect(searchParams.get("preset")).toBe("today");
  expect(searchParams.get("log")).toBe("today_log");
});
