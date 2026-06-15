import { expect, test } from "@playwright/test";
import { getOtpFromDb } from "../helpers";

test("verify email with correct OTP redirects to organization creation", async ({
  page,
}) => {
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

test("resend OTP button shows countdown after click", async ({ page }) => {
  const email = `e2e-resend-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Resend Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  const resendButton = page.locator("#resend-otp-button");
  await expect(resendButton).toBeVisible();
  await resendButton.click();

  await expect(resendButton).toContainText("Resend OTP", { timeout: 10_000 });
  await expect(resendButton).toBeDisabled({ timeout: 10_000 });
});

test("not your email button redirects to sign-up", async ({ page }) => {
  const email = `e2e-notyou-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Not Your Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.click("text=Not your email?");

  await page.waitForURL("**/sign-up", { timeout: 30_000 });
  await expect(page.locator("#sign-up-form")).toBeVisible();
});

test("verify email with empty OTP shows error", async ({ page }) => {
  const email = `e2e-emptyotp-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Empty OTP Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.click("#verify-email-submit-button");

  await expect(page.locator("#verify-email-form")).toContainText(
    "Invalid OTP",
    {
      timeout: 10_000,
    },
  );
});

test("verify email with expired OTP shows error", async ({ page }) => {
  const email = `e2e-expiredotp-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Expired OTP Test");
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

test("already verified user is redirected from verify-email", async ({
  page,
}) => {
  const email = `e2e-already-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Already Verified");
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

  await page.goto(`/verify-email?email=${encodeURIComponent(email)}`, {
    waitUntil: "networkidle",
  });

  await page.waitForURL(
    (url: URL) => {
      return (
        url.pathname === "/organizations/new" ||
        url.pathname === "/organizations" ||
        url.pathname.startsWith("/a/")
      );
    },
    { timeout: 30_000 },
  );
});
