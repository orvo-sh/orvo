import { expect, test } from "@playwright/test";
import { getOtpFromDb } from "../helpers";

test("unauthenticated user is redirected to sign-in from dashboard", async ({
  page,
}) => {
  await page.goto("/apps/new", { waitUntil: "networkidle" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});

test("unauthenticated user is redirected to sign-in from settings", async ({
  page,
}) => {
  await page.goto("/settings/billing", { waitUntil: "networkidle" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});

test("authenticated user without org is redirected to org creation", async ({
  page,
}) => {
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  const email = `e2e-guard-noorg-${Date.now()}@test-accounts.orvo.sh`;
  await page.locator("#sign-up-name").fill("No Org Guard");
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

test("authenticated user is redirected from auth pages to dashboard", async ({
  page,
}) => {
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  const email = `e2e-guard-authed-${Date.now()}@test-accounts.orvo.sh`;
  await page.locator("#sign-up-name").fill("Authed Guard");
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
  await page.locator("#organization-name").fill("Guard Org");
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });

  await page.goto("/sign-in", { waitUntil: "networkidle" });

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

test("unverified user is redirected to verify-email", async ({ page }) => {
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  const email = `e2e-guard-unverified-${Date.now()}@test-accounts.orvo.sh`;
  await page.locator("#sign-up-name").fill("Unverified Guard");
  await page.locator("#sign-up-email").fill(email);
  await page.locator("#sign-up-password").fill("VeryS3cure!");
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.goto("/apps/new", { waitUntil: "networkidle" });

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });
  await expect(page.locator("#verify-email-form")).toBeVisible();
});

test("verify-email page without email param redirects to sign-in", async ({
  page,
}) => {
  await page.goto("/verify-email", { waitUntil: "networkidle" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});
