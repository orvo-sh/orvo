import { expect, test, type Page } from "@playwright/test";
import { getDb } from "@repo/db";
import { app, ingestionKey, member, user } from "@repo/db/schema";
import { genId } from "@repo/utils";
import { eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const screenshotsDir = resolve(process.cwd(), "../site/static/screenshots");
const db = getDb(process.env.POSTGRES_URL!);
const fullUserEmail = "setup-full-user@test-accounts.orvo.sh";

test.use({ storageState: "tests/.auth/full-user.json" });
test.setTimeout(90_000);

const saveScreenshot = async (page: Page, name: string) => {
  const path = resolve(screenshotsDir, `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({
    path,
    animations: "disabled",
    fullPage: false,
  });
};

const createAppForCapture = async (name: string) => {
  const fullUser = await db
    .select({
      userId: user.id,
      organizationId: member.organizationId,
    })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .where(eq(user.email, fullUserEmail))
    .limit(1);

  const currentUser = fullUser[0];
  expect(currentUser).toBeTruthy();

  const appId = genId("app");

  await db.insert(app).values({
    id: appId,
    organizationId: currentUser.organizationId,
    name,
    createdBy: currentUser.userId,
    updatedBy: currentUser.userId,
  });

  await db.insert(ingestionKey).values([
    {
      id: genId("ingk"),
      appId,
      kind: "public",
      key: genId("pk"),
      createdBy: currentUser.userId,
    },
    {
      id: genId("ingk"),
      appId,
      kind: "private",
      key: genId("sk"),
      createdBy: currentUser.userId,
    },
  ]);

  return appId;
};

test("capture site screenshots from live product screens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });

  const appId = await createAppForCapture(`Site capture ${Date.now()}`);

  await page.goto(`/a/${appId}/overview`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await saveScreenshot(page, "overview");

  await page.goto(`/a/${appId}/logs`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible();
  await saveScreenshot(page, "logs");

  await page.goto(`/a/${appId}/traces`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Traces" })).toBeVisible();
  await saveScreenshot(page, "traces");

  await page.goto(`/a/${appId}/heartbeats`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Heartbeats" })).toBeVisible();
  await saveScreenshot(page, "heartbeats");
});
