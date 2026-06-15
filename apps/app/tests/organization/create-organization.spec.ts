import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/.auth/verified-no-org.json" });

test("create organization after sign up", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  await page.locator("#organization-name").fill("Acme Observatory");
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });
  await expect(page.locator("h1")).toContainText("Choose a plan");
});

test("create organization with empty name disables submit button", async ({
  page,
}) => {
  await page.goto("/organizations/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  await expect(
    page.locator("#create-organization-submit-button"),
  ).toBeDisabled();
});

test("upload organization logo", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "networkidle" });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeHidden();

  await page.click("#upload-organization-logo-button");

  // Create a small test image
  const testImageBuffer = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  // Intercept the presigned PUT upload to avoid MinIO CORS issues in tests
  await page.route("**/*", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200 });
    } else {
      await route.continue();
    }
  });

  await fileInput.setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: testImageBuffer,
  });

  await expect(page.locator("#upload-organization-logo-button")).toBeEnabled({
    timeout: 15_000,
  });
  await expect(page.locator("#upload-organization-logo-button")).toContainText(
    "Change logo",
  );

  await expect(page.locator("#remove-organization-logo-button")).toBeVisible();
});

test("remove organization logo", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "networkidle" });

  const fileInput = page.locator('input[type="file"]');
  await page.click("#upload-organization-logo-button");

  const testImageBuffer = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  // Intercept the presigned PUT upload to avoid MinIO CORS issues in tests
  await page.route("**/*", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200 });
    } else {
      await route.continue();
    }
  });

  await fileInput.setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: testImageBuffer,
  });

  await expect(page.locator("#remove-organization-logo-button")).toBeVisible({
    timeout: 15_000,
  });

  await page.click("#remove-organization-logo-button");

  await expect(page.locator("#upload-organization-logo-button")).toBeEnabled();
  await expect(page.locator("#upload-organization-logo-button")).toContainText(
    "Upload logo",
  );
});

test("select organization from list", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "networkidle" });
  await page.locator("#organization-name").fill("First Organization");
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });

  await page.goto("/organizations", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("Select an organization");

  const orgButton = page.locator("button", { hasText: "First Organization" });
  await expect(orgButton).toBeVisible();
});

test.describe("with existing organization", () => {
  test.use({ storageState: "tests/.auth/full-user.json" });

  test("new organization button from list page works", async ({ page }) => {
    await page.goto("/organizations", { waitUntil: "networkidle" });
    await expect(page.locator("#new-organization-button")).toBeVisible();
    await page.click("#new-organization-button");
    await page.waitForURL("**/organizations/new", { timeout: 30_000 });
    await expect(page.locator("#create-organization-form")).toBeVisible();
  });
});
