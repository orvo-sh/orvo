import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";

test.use({ storageState: { cookies: [], origins: [] } });

test("resets a forgotten password from the sign-in screen", async ({
  page,
}) => {
  const email = `reset-${crypto.randomUUID()}@example.com`;
  const password = "original-password-123";
  const newPassword = "replacement-password-456";
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: "Password reset" },
  });
  expect(signup.ok()).toBeTruthy();
  await page.context().clearCookies();

  await page.goto("/sign-in?callback=%2Forganizations");
  await page.locator("#forgot-password-link").click();
  await page.locator("#forgot-password-email").fill(email);
  await page.locator("#forgot-password-submit-button").click();
  await expect(page.locator("#forgot-password-success")).toBeVisible();

  const db = getDb(process.env.POSTGRES_URL!);
  const user = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.email, email),
  });
  expect(user).toBeTruthy();
  const record = await db.query.verification.findFirst({
    where: (record, { and, eq, like }) =>
      and(
        eq(record.value, user!.id),
        like(record.identifier, "reset-password:%"),
      ),
  });
  expect(record).toBeTruthy();
  const token = record!.identifier.slice("reset-password:".length);
  const callback = encodeURIComponent(
    "/reset-password?callback=%2Forganizations",
  );
  await page.goto(`/api/auth/reset-password/${token}?callbackURL=${callback}`);
  await page.locator("#reset-password-new").fill(newPassword);
  await page.locator("#reset-password-confirm").fill("different-password");
  await page.locator("#reset-password-submit-button").click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await page.locator("#reset-password-confirm").fill(newPassword);
  await page.locator("#reset-password-submit-button").click();
  await expect(page.locator("#reset-password-sign-in-button")).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
  await page.locator("#reset-password-sign-in-button").click();
  await expect(page).toHaveURL(/sign-in\?callback=%2Forganizations/);
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: newPassword },
  });
  expect(login.ok()).toBeTruthy();
});

test("offers a new link when the reset token is missing", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.locator("#reset-password-invalid-token")).toBeVisible();
  await page.getByRole("link", { name: "Request a new link" }).click();
  await expect(page.locator("#forgot-password-email")).toBeVisible();
});
