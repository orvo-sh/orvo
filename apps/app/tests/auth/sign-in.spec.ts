import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

const account = {
  name: "Sign In Test",
  email: `e2e-signin-${Date.now()}@test-accounts.orvo.sh`,
  password: "VeryS3cure!",
};

const organizationName = "SignIn Observatory";

test("sign in with existing account", async ({ page }) => {
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
  await page.fill("#organization-name", organizationName);
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/settings/billing", { timeout: 30_000 });

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sign-in-form")).toBeVisible();

  await page.fill("#sign-in-email", account.email);
  await page.fill("#sign-in-password", account.password);
  await page.click("#sign-in-submit-button");

  await page.waitForURL(
    (url: URL) => {
      return (
        url.pathname === "/organizations" ||
        url.pathname === "/settings/billing" ||
        url.pathname.startsWith("/a/")
      );
    },
    { timeout: 30_000 },
  );
});

test("sign in with wrong password shows error", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sign-in-form")).toBeVisible();

  await page.fill("#sign-in-email", account.email);
  await page.fill("#sign-in-password", "WrongPassword123");
  await page.click("#sign-in-submit-button");

  await expect(page.locator("#sign-in-form")).toContainText("invalid", {
    timeout: 10_000,
  });
});

test("sign in with non-existent email shows error", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sign-in-form")).toBeVisible();

  await page.fill("#sign-in-email", `nonexistent-${Date.now()}@test.orvo.sh`);
  await page.fill("#sign-in-password", "SomePassword123");
  await page.click("#sign-in-submit-button");

  await expect(page.locator("#sign-in-form")).toContainText("invalid", {
    timeout: 10_000,
  });
});

test("unauthenticated user is redirected to sign-in from dashboard", async ({
  page,
}) => {
  await page.goto("/apps", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});
