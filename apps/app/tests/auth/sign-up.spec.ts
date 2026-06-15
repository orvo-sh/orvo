import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

const account = {
  name: "Taylor Orvo",
  email: `e2e-signup-${Date.now()}@test-accounts.orvo.sh`,
  password: "VeryS3cure!",
};

test("sign up with email and password", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sign-up-form")).toBeVisible();

  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await expect(page).toHaveURL(
    new RegExp(`/verify-email\\?email=${encodeURIComponent(account.email)}`),
  );
});

test("sign up shows error for existing email", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sign-up-form")).toBeVisible();

  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await expect(page.locator("#sign-up-form")).toContainText("already exists", {
    timeout: 10_000,
  });
});

test("sign up with invalid email shows error", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });

  await page.fill("#sign-up-name", "Test User");
  await page.fill("#sign-up-email", "not-an-email");
  await page.fill("#sign-up-password", "password123");
  await page.click("#sign-up-submit-button");

  await expect(page.locator("#sign-up-form")).toContainText("invalid email", {
    timeout: 10_000,
  });
});

test("sign up with weak password shows error", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });

  await page.fill("#sign-up-name", "Test User");
  await page.fill(
    "#sign-up-email",
    `e2e-weak-${Date.now()}@test-accounts.orvo.sh`,
  );
  await page.fill("#sign-up-password", "123");
  await page.click("#sign-up-submit-button");

  await expect(page.locator("#sign-up-form")).toContainText("password", {
    timeout: 10_000,
  });
});

test("verify email with OTP", async ({ page }) => {
  const email = `e2e-verify-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", "Verify Test");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", "VeryS3cure!");
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
  await expect(page.locator("#create-organization-form")).toBeVisible();
});

test("verify email with wrong OTP shows error", async ({ page }) => {
  const email = `e2e-wrongotp-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", "Wrong OTP Test");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", "VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.fill("#verify-email-otp", "000000");
  await page.click("#verify-email-submit-button");

  await expect(page.locator("#verify-email-form")).toContainText("invalid", {
    timeout: 10_000,
  });
});
