import { expect, test } from "@playwright/test";
import { getOtpFromDb } from "../helpers";

test("sign in with existing account", async ({ page }) => {
  const email = `e2e-signin-${Date.now()}@test-accounts.orvo.sh`;
  const password = "VeryS3cure!";
  const organizationName = "SignIn Observatory";

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Sign In Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill(password);
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
  await page.locator("#organization-name").fill(organizationName);
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });

  await page.context().clearCookies();
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await expect(page.locator("#sign-in-form")).toBeVisible();

  await page.locator("#sign-in-email").fill(email);
  await page.locator("#sign-in-password").fill(password);
  await page.click("#sign-in-submit-button");

  await page.waitForURL(
    (url: URL) => {
      return (
        url.pathname === "/organizations" ||
        url.pathname === "/organizations/plan" ||
        url.pathname.startsWith("/a/") ||
        url.pathname === "/apps/new"
      );
    },
    { timeout: 30_000 },
  );
});

test("sign in with wrong password shows error", async ({ page }) => {
  const email = `e2e-wrongpwd-${Date.now()}@test-accounts.orvo.sh`;
  const password = "VeryS3cure!";

  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.locator("#sign-up-name").fill("Wrong Password Test");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill(password);
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

  await page.context().clearCookies();
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await expect(page.locator("#sign-in-form")).toBeVisible();

  await page.locator("#sign-in-email").fill(email);
  await page.locator("#sign-in-password").fill("WrongPassword123");
  await page.click("#sign-in-submit-button");

  await expect(page.locator("#sign-in-form")).toContainText("Incorrect", {
    timeout: 10_000,
  });
});

test("sign in with non-existent email shows error", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await expect(page.locator("#sign-in-form")).toBeVisible();

  await page
    .locator("#sign-in-email")
    .fill(`nonexistent-${Date.now()}@test.orvo.sh`);
  await page.locator("#sign-in-password").fill("SomePassword123");
  await page.click("#sign-in-submit-button");

  await expect(page.locator("#sign-in-form")).toContainText("Incorrect", {
    timeout: 10_000,
  });
});
