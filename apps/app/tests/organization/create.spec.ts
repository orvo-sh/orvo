import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/.auth/verified-no-org.json" });

test("create organization after sign up", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  await page.fill("#organization-name", "Acme Observatory");
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });
  await expect(page.locator("h1")).toContainText("Choose a plan");
});

test("create organization with empty name shows error", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  await page.click("#create-organization-submit-button");

  await expect(page.locator("#create-organization-form")).toContainText(
    "name",
    { timeout: 10_000 },
  );
});

test("upload organization logo", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeHidden();

  await page.click("#upload-organization-logo-button");

  // Create a small test image
  const testImageBuffer = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  await fileInput.setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: testImageBuffer,
  });

  await expect(page.locator("#upload-organization-logo-button")).toContainText(
    "Change logo",
    { timeout: 15_000 },
  );

  await expect(page.locator("#remove-organization-logo-button")).toBeVisible();
});

test("remove organization logo", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "domcontentloaded" });

  const fileInput = page.locator('input[type="file"]');
  await page.click("#upload-organization-logo-button");

  const testImageBuffer = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  await fileInput.setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: testImageBuffer,
  });

  await expect(page.locator("#remove-organization-logo-button")).toBeVisible({
    timeout: 15_000,
  });

  await page.click("#remove-organization-logo-button");

  await expect(page.locator("#upload-organization-logo-button")).toContainText(
    "Upload logo",
  );
});

test("select organization from list", async ({ page }) => {
  await page.goto("/organizations/new", { waitUntil: "domcontentloaded" });
  await page.fill("#organization-name", "First Organization");
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });

  await page.goto("/organizations", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Select an organization");

  const orgButton = page.locator("button", { hasText: "First Organization" });
  await expect(orgButton).toBeVisible();
});

test("new organization button from list page works", async ({ page }) => {
  await page.goto("/organizations", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#new-organization-button")).toBeVisible();
  await page.click("#new-organization-button");
  await page.waitForURL("**/organizations/new", { timeout: 30_000 });
  await expect(page.locator("#create-organization-form")).toBeVisible();
});
