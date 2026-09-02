import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";
import { app } from "@repo/db/schema";
import { genId } from "@repo/utils";

test.use({ storageState: "tests/.auth/full-user.json" });

test("creates a notification destination without reopening the dialog", async ({
  page,
}) => {
  const db = getDb(process.env.POSTGRES_URL!);
  const testUser = await db.query.user.findFirst({
    where: ({ email }, { eq }) =>
      eq(email, "setup-full-user@test-accounts.orvo.sh"),
  });
  expect(testUser).toBeTruthy();

  const currentMember = await db.query.member.findFirst({
    where: ({ userId }, { eq }) => eq(userId, testUser!.id),
  });
  expect(currentMember).toBeTruthy();

  const appId = genId("app");
  await db.insert(app).values({
    id: appId,
    organizationId: currentMember!.organizationId,
    name: `Notification test app ${appId}`,
    createdBy: testUser!.id,
    updatedBy: testUser!.id,
  });

  await page.goto(`/a/${appId}/settings/notification-destinations`);
  await page.getByRole("link", { name: "Add destination" }).click();
  await expect(page).toHaveURL(/\?create=1$/);

  const dialog = page.getByRole("dialog", {
    name: "Add notification destination",
  });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Destination type").click();
  await page.getByRole("option", { name: "Email" }).click();
  await dialog.getByLabel("Name").fill("Primary responders");
  await dialog.getByLabel("Recipients").fill("alerts@example.com");
  await dialog.getByLabel("Recipients").press("Enter");
  await expect(dialog.getByText("alerts@example.com")).toBeVisible();

  await dialog.getByRole("button", { name: "Add destination" }).click();

  await expect(page).not.toHaveURL(/create=1/);
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Primary responders")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(dialog).toBeHidden();

  await page.goto(
    `/a/${appId}/settings/notification-destinations?create=1`,
  );
  await dialog.getByLabel("Destination type").click();
  await page.getByRole("option", { name: "Slack" }).click();

  await expect(dialog.getByText("Connect a Slack channel")).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Connect to Slack" }),
  ).toHaveAttribute("href", `/api/integrations/slack/connect?app_id=${appId}`);
  await expect(dialog.getByLabel("Name")).toHaveCount(0);
});
