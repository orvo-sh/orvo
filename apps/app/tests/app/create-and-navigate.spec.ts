import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/.auth/full-user.json" });

test("create app after organization setup", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-app-form")).toBeVisible();

  await page.locator("#app-name").fill("Test Application");
  await expect(page.locator("#create-app-submit-button")).toBeEnabled();
  await page.click("#create-app-submit-button");

  await page.waitForURL(/\/a\//, { timeout: 30_000 });
  await expect(page.locator("h1")).toContainText("Overview");
});

test("create app with empty name shows error", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-app-form")).toBeVisible();

  await expect(page.locator("#create-app-submit-button")).toBeDisabled();

  await page.locator("#app-name").fill("A");
  await page.locator("#app-name").press("Enter");

  await expect(page.locator("#create-app-form")).toContainText("name", {
    timeout: 10_000,
  });
});

test("navigate to app overview after creation", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-app-form")).toBeVisible();

  await page.locator("#app-name").fill("Navigate App");
  await expect(page.locator("#create-app-submit-button")).toBeEnabled();
  await page.click("#create-app-submit-button");

  await page.waitForURL(/\/a\//, { timeout: 30_000 });

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Logs" }).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Traces" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Metrics" }).first(),
  ).toBeVisible();
});

test("app settings page renders", async ({ page }) => {
  await page.goto("/apps/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-app-form")).toBeVisible();

  await page.locator("#app-name").fill("Settings App");
  await expect(page.locator("#create-app-submit-button")).toBeEnabled();
  await page.click("#create-app-submit-button");

  await page.waitForURL(/\/a\//, { timeout: 30_000 });

  const appId = page.url().split("/a/")[1]?.split("/")[0];
  if (!appId) {
    throw new Error("Could not extract app ID from URL");
  }

  await page.goto(`/a/${appId}/settings`, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("General");
});
