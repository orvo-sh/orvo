import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

const account = {
  name: "Organization Test",
  email: `e2e-org-${Date.now()}@test-accounts.orvo.sh`,
  password: "VeryS3cure!",
};

const organizationName = "Acme Observatory";

test("create organization after sign up", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  let otp = "";
  await expect
    .poll(
      async () => {
        const record = await db.query.verification.findFirst({
          where: ({ identifier }, { eq }) => eq(identifier, account.email),
        });
        otp = record?.value ?? "";
        return otp.length === 6 ? otp : null;
      },
      { timeout: 10_000, intervals: [1_000] },
    )
    .not.toBeNull();

  await page.fill("#verify-email-otp", otp);
  await page.click("#verify-email-submit-button");

  await page.waitForURL("**/organizations/new", { timeout: 30_000 });
  await expect(page.locator("#create-organization-form")).toBeVisible();

  await page.fill("#organization-name", organizationName);
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });
  await expect(page.locator("h1")).toContainText("Choose a plan");
});

test("create organization with empty name shows error", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  const email = `e2e-org-empty-${Date.now()}@test-accounts.orvo.sh`;
  await page.fill("#sign-up-name", "Empty Org Test");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  let otp = "";
  await expect
    .poll(
      async () => {
        const record = await db.query.verification.findFirst({
          where: ({ identifier }, { eq }) => eq(identifier, email),
        });
        otp = record?.value ?? "";
        return otp.length === 6 ? otp : null;
      },
      { timeout: 10_000, intervals: [1_000] },
    )
    .not.toBeNull();

  await page.fill("#verify-email-otp", otp);
  await page.click("#verify-email-submit-button");

  await page.waitForURL("**/organizations/new", { timeout: 30_000 });

  await page.click("#create-organization-submit-button");

  await expect(page.locator("#create-organization-form")).toContainText(
    "name",
    { timeout: 10_000 },
  );
});

test("select organization from list", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  const email = `e2e-org-select-${Date.now()}@test-accounts.orvo.sh`;
  await page.fill("#sign-up-name", "Select Org Test");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  let otp = "";
  await expect
    .poll(
      async () => {
        const record = await db.query.verification.findFirst({
          where: ({ identifier }, { eq }) => eq(identifier, email),
        });
        otp = record?.value ?? "";
        return otp.length === 6 ? otp : null;
      },
      { timeout: 10_000, intervals: [1_000] },
    )
    .not.toBeNull();

  await page.fill("#verify-email-otp", otp);
  await page.click("#verify-email-submit-button");

  await page.waitForURL("**/organizations/new", { timeout: 30_000 });

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
