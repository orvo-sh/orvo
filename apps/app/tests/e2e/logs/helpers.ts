import { expect, type Page } from "@playwright/test";
import { getClickHouseClient, type ClickHouse } from "@repo/clickhouse";
import { getDb } from "@repo/db";
import { member, user } from "@repo/db/schema";
import { eq } from "drizzle-orm";

import { createApp, buildLog, insertLogs } from "../../helpers";

const db = getDb(process.env.POSTGRES_URL!);
const clickhouse = getClickHouseClient({ url: process.env.CLICKHOUSE_URL! });

const FULL_USER_EMAIL = "setup-full-user@test-accounts.orvo.sh";

const getFullUserContext = async () => {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.email, FULL_USER_EMAIL),
  });
  if (!currentUser) {
    throw new Error(`Could not find seeded test user ${FULL_USER_EMAIL}`);
  }

  const currentMember = await db.query.member.findFirst({
    where: eq(member.userId, currentUser.id),
  });
  if (!currentMember) {
    throw new Error(`Could not find organization membership for ${FULL_USER_EMAIL}`);
  }

  return {
    user: currentUser,
    organizationId: currentMember.organizationId,
  };
};

const createLogsTestApp = async () => {
  const { user: currentUser, organizationId } = await getFullUserContext();
  return createApp(db, {
    organizationId,
    createdBy: currentUser.id,
    updatedBy: currentUser.id,
    name: `Logs test ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`,
  });
};

const seedLogsForApp = async (
  appId: string,
  rows: ReturnType<typeof buildLog>[],
) => {
  await insertLogs(
    clickhouse,
    rows.map((row) =>
      buildLog({
        ...row,
        app_id: appId,
      }),
    ),
  );
};

const openLogsPage = async (page: Page, appId: string, search = "") => {
  await page.goto(`/a/${appId}/logs${search}`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByTestId("logs-table")).toBeVisible();
};

export { buildLog, createLogsTestApp, openLogsPage, seedLogsForApp };
