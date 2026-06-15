import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/.auth/full-user.json" });

test("create app after organization setup", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#create-app-form")).toBeVisible();

  await page.fill("#app-name", "Test Application");
  await page.click("#create-app-submit-button");

  await page.waitForURL(/\/a\//, { timeout: 30_000 });
  await expect(page.locator("h1")).toContainText("Overview");
});

test("create app with empty name shows error", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#create-app-form")).toBeVisible();

  await page.click("#create-app-submit-button");

  await expect(page.locator("#create-app-form")).toContainText("name", {
    timeout: 10_000,
  });
});

test("navigate to app overview after creation", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "domcontentloaded" });
  await page.fill("#app-name", "Navigate App");
  await page.click("#create-app-submit-button");

  await page.waitForURL(/\/a\//, { timeout: 30_000 });

  await expect(page.locator("text=Overview")).toBeVisible();
  await expect(page.locator("text=Logs")).toBeVisible();
  await expect(page.locator("text=Traces")).toBeVisible();
  await expect(page.locator("text=Metrics")).toBeVisible();
});

test("app settings page renders", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "domcontentloaded" });
  await page.fill("#app-name", "Settings App");
  await page.click("#create-app-submit-button");

  await page.waitForURL(/\/a\//, { timeout: 30_000 });

  const appId = page.url().split("/a/")[1]?.split("/")[0];
  if (!appId) {
    throw new Error("Could not extract app ID from URL");
  }

  await page.goto(`/a/${appId}/settings`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Settings");
});
