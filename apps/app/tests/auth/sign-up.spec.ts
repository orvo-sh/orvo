import { expect, test } from "@playwright/test";
import { getOtpFromDb } from "../helpers";

test("sign up with email and password", async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await expect(page.locator("#sign-up-form")).toBeVisible();
  await expect(page.locator("#sign-up-submit-button")).toBeVisible();

  await page.locator("#sign-up-name").fill("Taylor Orvo");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await expect(page).toHaveURL(
    new RegExp(`/verify-email\\?email=${encodeURIComponent(email)}`),
  );
});

test("sign up with weak password shows error", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await expect(page.locator("#sign-up-submit-button")).toBeVisible();

  await page.locator("#sign-up-name").fill("Test User");
  await page
    .locator("#sign-up-email")
    .fill(`e2e-weak-${Date.now()}@test-accounts.orvo.sh`);
  await page.locator("#sign-up-password").fill("123");
  await page.click("#sign-up-submit-button");

  await expect(page.locator("#sign-up-form")).toContainText(
    "Password is too short.",
    {
      timeout: 10_000,
    },
  );
});

test("verify email with OTP", async ({ page }) => {
  const email = `e2e-verify-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Verify Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  let otp = "";
  await expect
    .poll(
      async () => {
        otp = (await getOtpFromDb(email)) ?? "";
        return otp.length === 6 ? otp : null;
      },
      { timeout: 10_000, intervals: [1_000] },
    )
    .not.toBeNull();

  await page.locator("#verify-email-otp input").fill(otp);
  await page.click("#verify-email-submit-button");

  await page.waitForURL("**/organizations/new", { timeout: 30_000 });
  await expect(page.locator("#create-organization-form")).toBeVisible();
});

test("verify email with wrong OTP shows error", async ({ page }) => {
  const email = `e2e-wrongotp-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Wrong OTP Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.locator("#verify-email-otp input").fill("000000");
  await page.click("#verify-email-submit-button");

  await expect(page.locator("#verify-email-form")).toContainText(
    "Invalid OTP",
    {
      timeout: 10_000,
    },
  );
});
