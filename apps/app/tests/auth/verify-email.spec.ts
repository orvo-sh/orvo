import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

const account = {
  name: "Verify Email Test",
  email: `e2e-verify-email-${Date.now()}@test-accounts.orvo.sh`,
  password: "VeryS3cure!",
};

test("verify email page shows masked email", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  const maskedEmail = `${account.email.slice(0, 2)}***@${account.email.split("@")[1]}`;
  await expect(page.locator("#verify-email-form")).toContainText(maskedEmail);
});

test("verify email with correct OTP redirects to organization creation", async ({
  page,
}) => {
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
});

test("resend OTP button works", async ({ page }) => {
  const email = `e2e-resend-${Date.now()}@test-accounts.orvo.sh`;

  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", "Resend Test");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", "VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  const resendButton = page.locator("#resend-otp-button");
  await expect(resendButton).toBeVisible();
  await resendButton.click();

  await expect(resendButton).toContainText("Resend OTP", { timeout: 10_000 });

  let newOtp = "";
  await expect
    .poll(
      async () => {
        const record = await db.query.verification.findFirst({
          where: ({ identifier }, { eq }) => eq(identifier, email),
        });
        newOtp = record?.value ?? "";
        return newOtp.length === 6 ? newOtp : null;
      },
      { timeout: 10_000, intervals: [1_000] },
    )
    .not.toBeNull();

  await page.fill("#verify-email-otp", newOtp);
  await page.click("#verify-email-submit-button");

  await page.waitForURL("**/organizations/new", { timeout: 30_000 });
});

test("not your email button redirects to sign-up", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.click("text=Not your email?");

  await page.waitForURL("**/sign-up", { timeout: 30_000 });
  await expect(page.locator("#sign-up-form")).toBeVisible();
});

test("verify email with empty OTP shows error", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.click("#verify-email-submit-button");

  await expect(page.locator("#verify-email-form")).toContainText("invalid", {
    timeout: 10_000,
  });
});

test("verify email with expired OTP shows error", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", account.email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.fill("#verify-email-otp", "000000");
  await page.click("#verify-email-submit-button");

  await expect(page.locator("#verify-email-form")).toContainText("invalid", {
    timeout: 10_000,
  });
});

test("already verified user is redirected from verify-email", async ({
  page,
}) => {
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

  await page.goto(`/verify-email?email=${encodeURIComponent(account.email)}`, {
    waitUntil: "domcontentloaded",
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
