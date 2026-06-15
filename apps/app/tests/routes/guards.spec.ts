import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

const account = {
  name: "Guards Test",
  email: `e2e-guards-${Date.now()}@test-accounts.orvo.sh`,
  password: "VeryS3cure!",
};

test("unauthenticated user is redirected to sign-in from dashboard", async ({
  page,
}) => {
  await page.goto("/apps", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});

test("unauthenticated user is redirected to sign-in from settings", async ({
  page,
}) => {
  await page.goto("/settings/billing", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});

test("authenticated user without org is redirected to org creation", async ({
  page,
}) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  const email = `e2e-guard-noorg-${Date.now()}@test-accounts.orvo.sh`;
  await page.fill("#sign-up-name", account.name);
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
  await expect(page.locator("#create-organization-form")).toBeVisible();
});

test("authenticated user is redirected from auth pages to dashboard", async ({
  page,
}) => {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  const email = `e2e-guard-authed-${Date.now()}@test-accounts.orvo.sh`;
  await page.fill("#sign-up-name", account.name);
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
  await page.fill("#organization-name", "Guard Org");
  await page.click("#create-organization-submit-button");

  await page.waitForURL("**/organizations/plan", { timeout: 30_000 });

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

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
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  const email = `e2e-guard-unverified-${Date.now()}@test-accounts.orvo.sh`;
  await page.fill("#sign-up-name", account.name);
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", account.password);
  await page.click("#sign-up-submit-button");

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });

  await page.goto("/apps/new", { waitUntil: "domcontentloaded" });

  await page.waitForURL(/\/verify-email/, { timeout: 30_000 });
  await expect(page.locator("#verify-email-form")).toBeVisible();
});

test("verify-email page without email param redirects to sign-in", async ({
  page,
}) => {
  await page.goto("/verify-email", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/sign-in", { timeout: 30_000 });
  await expect(page.locator("#sign-in-form")).toBeVisible();
});
