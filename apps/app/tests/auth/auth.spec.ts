import { expect, test, type Page } from "@playwright/test";
import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

const account = {
  name: "Taylor Orvo",
  email: `e2e-${Date.now()}@test-accounts.orvo.sh`,
  password: "VeryS3cure!",
};
const organizationName = "Acme Observatory";

const loadOtp = async () => {
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
      {
        timeout: 10_000,
        intervals: [1_000],
      },
    )
    .not.toBeNull();

  return otp;
};

const fillOtp = async (otp: string, page: Page) => {
  const otpInputs = page.locator(
    '#verify-email-otp input[inputmode="numeric"]',
  );

  for (let index = 0; index < otp.length; index += 1) {
    await otpInputs.nth(index).fill(otp[index] ?? "");
  }
};

test.describe.serial("Auth happy path", () => {
  test("Sign up, verify email, create organization, and land on billing", async ({
    page,
  }) => {
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#sign-up-form")).toBeVisible();

    await page.fill("#sign-up-name", account.name);
    await page.fill("#sign-up-email", account.email);
    await page.fill("#sign-up-password", account.password);
    await page.click("#sign-up-submit-button");

    await expect(page).toHaveURL(
      new RegExp(`/verify-email\\?email=${encodeURIComponent(account.email)}`),
    );

    const otp = await loadOtp();
    await fillOtp(otp, page);
    await page.click("#verify-email-submit-button");

    await page.waitForURL("**/organizations/new", { timeout: 15_000 });
    await expect(page.locator("#create-organization-form")).toBeVisible();

    await page.fill("#organization-name", organizationName);
    await page.click("#create-organization-submit-button");

    await page.waitForURL("**/settings/billing?onboarding=1", {
      timeout: 15_000,
    });
    await expect(page.locator("#billing-success-banner")).toContainText(
      "Choose a plan to activate this organization.",
    );
  });

  test("Sign in with the existing account and return to the billing flow", async ({
    page,
  }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#sign-in-form")).toBeVisible();

    await page.fill("#sign-in-email", account.email);
    await page.fill("#sign-in-password", account.password);
    await page.click("#sign-in-submit-button");

    await page.waitForURL((url: URL) => {
      return (
        url.pathname === "/organizations" ||
        url.pathname === "/settings/billing"
      );
    });

    if (page.url().includes("/organizations")) {
      await page.getByRole("button", { name: organizationName }).click();
      await page.waitForURL("**/settings/billing", { timeout: 15_000 });
    }

    await expect(page.getByText("Billing overview")).toBeVisible();
  });
});
