import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";
import { organization, organizationUsage } from "@repo/db/schema";
import { genId } from "@repo/utils";
import { eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const db = getDb(process.env.POSTGRES_URL!);

const AUTH_DIR = "tests/.auth";

const getOtpFromDb = async (email: string) => {
  const record = await db.query.verification.findFirst({
    where: ({ identifier }, { like }) =>
      like(identifier, `%email-verification-otp-${email}`),
  });
  return record?.value?.split(":")[0] ?? null;
};

const waitForOtp = async (email: string) => {
  let otp: string | null = null;
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    otp = await getOtpFromDb(email);
    if (otp && otp.length === 6) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return otp;
};

test("create unverified state", async ({ page }) => {
  const email = `setup-unverified@test-accounts.orvo.sh`;
  const password = "VeryS3cure!";

  const response = await page.request.post("/api/auth/sign-up/email", {
    data: { email, name: "Unverified User", password },
  });
  expect(response.ok()).toBeTruthy();

  await page.goto(`/verify-email?email=${encodeURIComponent(email)}`);
  await page.waitForLoadState("networkidle");

  await mkdir(dirname(`${AUTH_DIR}/unverified.json`), { recursive: true });
  await page.context().storageState({ path: `${AUTH_DIR}/unverified.json` });
});

test("create verified-no-org state", async ({ page }) => {
  const email = `setup-no-org@test-accounts.orvo.sh`;
  const password = "VeryS3cure!";

  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { email, name: "No Org User", password },
  });
  expect(signUp.ok()).toBeTruthy();

  const otp = await waitForOtp(email);
  expect(otp).not.toBeNull();

  const verify = await page.request.post("/api/auth/email-otp/verify-email", {
    data: { email, otp },
  });
  expect(verify.ok()).toBeTruthy();

  const signIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  expect(signIn.ok()).toBeTruthy();

  await page.goto("/organizations/new");
  await page.waitForLoadState("networkidle");

  await mkdir(dirname(`${AUTH_DIR}/verified-no-org.json`), { recursive: true });
  await page
    .context()
    .storageState({ path: `${AUTH_DIR}/verified-no-org.json` });
});

test("create full-user state", async ({ page }) => {
  const email = `setup-full-user@test-accounts.orvo.sh`;
  const password = "VeryS3cure!";
  const orgName = "Setup Observatory";

  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { email, name: "Full User", password },
  });
  expect(signUp.ok()).toBeTruthy();

  const otp = await waitForOtp(email);
  expect(otp).not.toBeNull();

  const verify = await page.request.post("/api/auth/email-otp/verify-email", {
    data: { email, otp },
  });
  expect(verify.ok()).toBeTruthy();

  const signIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  expect(signIn.ok()).toBeTruthy();

  const orgResponse = await page.request.post("/api/auth/organization/create", {
    data: {
      name: orgName,
      slug: `setup-observatory-${Date.now()}`,
    },
  });
  expect(orgResponse.ok()).toBeTruthy();

  const orgData = await orgResponse.json();

  const activeResponse = await page.request.post(
    "/api/auth/organization/set-active",
    {
      data: { organizationId: orgData.id },
    },
  );
  expect(activeResponse.ok()).toBeTruthy();

  await db
    .update(organization)
    .set({ billingPlan: "starter", billingStatus: "active" })
    .where(eq(organization.id, orgData.id));

  await db.insert(organizationUsage).values({
    id: genId("orgu"),
    organizationId: orgData.id,
    logsRetentionDays: 14,
    tracesRetentionDays: 14,
    metricsRetentionDays: 14,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ingestLimitBytes: 50 * Math.pow(1024, 3),
  });

  await page.goto("/apps/new");
  await page.waitForLoadState("networkidle");

  await mkdir(dirname(`${AUTH_DIR}/full-user.json`), { recursive: true });
  await page.context().storageState({ path: `${AUTH_DIR}/full-user.json` });
});
