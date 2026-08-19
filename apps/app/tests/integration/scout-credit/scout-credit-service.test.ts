import { ScoutCreditService } from "$lib/server/services/scout-credit";
import { eq, type DB } from "@repo/db";
import {
  chat,
  organizationUsage,
  scoutCreditGrant,
  scoutUsage,
  scoutUsageAllocation,
  user,
} from "@repo/db/schema";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  applyPostgresMigrations,
  createApp,
  createOrganization,
  createTestLogger,
  getTestDb,
  startPostgresContainer,
  stopPostgresContainer,
  truncatePostgresTables,
} from "../../helpers";

describe("ScoutCreditService", () => {
  let container: Awaited<ReturnType<typeof startPostgresContainer>>;
  let db: DB;
  let service: ScoutCreditService;

  beforeAll(async () => {
    container = await startPostgresContainer();
    db = getTestDb(container.getConnectionUri());
    await applyPostgresMigrations(db);
    service = new ScoutCreditService(db, createTestLogger() as never);
  });

  beforeEach(async () => {
    await truncatePostgresTables(db, [
      "scout_usage_allocation",
      "scout_usage",
      "scout_credit_grant",
      "chat",
      "app",
      "organization_usage",
      "organization",
      '"user"',
    ]);

    await db.insert(user).values({
      id: "user_scout",
      name: "Scout user",
      email: "scout@example.com",
      emailVerified: true,
    });
    const currentOrganization = await createOrganization(db, {
      id: "org_scout",
      slug: "scout-org",
      billingPlan: "starter",
      billingStatus: "active",
    });
    await db.insert(organizationUsage).values({
      id: "orgu_scout",
      organizationId: currentOrganization.id,
      logsRetentionDays: 14,
      tracesRetentionDays: 14,
      metricsRetentionDays: 14,
      currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1_000),
      currentPeriodEnd: new Date(Date.now() + 29 * 24 * 60 * 60 * 1_000),
      ingestLimitBytes: 50 * Math.pow(1024, 3),
    });
    const currentApp = await createApp(db, {
      id: "app_scout",
      organizationId: currentOrganization.id,
      createdBy: "user_scout",
    });
    await db.insert(chat).values({
      id: "chat_scout",
      organizationId: currentOrganization.id,
      appId: currentApp.id,
      createdBy: "user_scout",
    });
  });

  afterAll(async () => {
    if (container) await stopPostgresContainer(container);
  });

  test("creates the plan grant lazily and charges usage once", async () => {
    const initialBalance = await service.getBalance({
      organizationId: "org_scout",
    });
    expect(initialBalance).toMatchObject({
      success: true,
      data: {
        included: 150_000,
        includedAllowance: 150_000,
        purchased: 0,
        total: 150_000,
      },
    });

    const input = {
      operationId: "chat_scout:message_one",
      organizationId: "org_scout",
      appId: "app_scout",
      chatId: "chat_scout",
      userId: "user_scout",
      model: "gemini-test",
      inputTokens: 125,
      outputTokens: 75,
      totalTokens: 200,
    };
    expect(await service.recordUsage(input)).toMatchObject({
      success: true,
      data: { credits: 200, unfundedCredits: 0 },
    });
    expect(await service.recordUsage(input)).toMatchObject({
      success: true,
      data: { credits: 200, unfundedCredits: 0 },
    });

    const [grant] = await db
      .select()
      .from(scoutCreditGrant)
      .where(eq(scoutCreditGrant.organizationId, "org_scout"));
    const usages = await db.select().from(scoutUsage);
    expect(grant.remainingCredits).toBe(149_800);
    expect(usages).toHaveLength(1);
  });

  test("uses expiring plan credits before purchased credits", async () => {
    await service.getBalance({ organizationId: "org_scout" });
    await db
      .update(scoutCreditGrant)
      .set({ remainingCredits: 100 })
      .where(eq(scoutCreditGrant.organizationId, "org_scout"));
    await db.insert(scoutCreditGrant).values({
      id: "scoutg_purchase",
      organizationId: "org_scout",
      source: "purchase",
      sourceReference: "checkout:test",
      grantedCredits: 500,
      remainingCredits: 500,
    });

    await service.recordUsage({
      operationId: "chat_scout:message_two",
      organizationId: "org_scout",
      appId: "app_scout",
      chatId: "chat_scout",
      userId: "user_scout",
      model: "gemini-test",
      totalTokens: 250,
    });

    const grants = await db
      .select()
      .from(scoutCreditGrant)
      .where(eq(scoutCreditGrant.organizationId, "org_scout"));
    const allocations = await db.select().from(scoutUsageAllocation);
    expect(
      grants.find((grant) => grant.source === "plan")?.remainingCredits,
    ).toBe(0);
    expect(
      grants.find((grant) => grant.source === "purchase")?.remainingCredits,
    ).toBe(350);
    expect(allocations.map((allocation) => allocation.credits).sort()).toEqual([
      100, 150,
    ]);
  });
});
