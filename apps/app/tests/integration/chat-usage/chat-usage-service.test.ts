import { ChatUsageService } from "$lib/server/services/chat-usage";
import { createSyncStripeSubscriptionState } from "$lib/server/services/billing/shared";
import { eq, type DB } from "@repo/db";
import { organization, organizationUsage } from "@repo/db/schema";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import type Stripe from "stripe";

import {
  applyPostgresMigrations,
  createOrganization,
  createTestLogger,
  getTestDb,
  startPostgresContainer,
  stopPostgresContainer,
  truncatePostgresTables,
} from "../../helpers";

describe("ChatUsageService", () => {
  let container: Awaited<ReturnType<typeof startPostgresContainer>>;
  let db: DB;
  let service: ChatUsageService;

  beforeAll(async () => {
    container = await startPostgresContainer();
    db = getTestDb(container.getConnectionUri());
    await applyPostgresMigrations(db);
    service = new ChatUsageService(db, createTestLogger() as never, {
      allowUnmetered: false,
    });
  });

  beforeEach(async () => {
    await truncatePostgresTables(db, ["organization_usage", "organization"]);

    const currentOrganization = await createOrganization(db, {
      id: "org_chat_usage",
      slug: "chat-usage-org",
      billingPlan: "pro",
      billingStatus: "active",
    });
    await db.insert(organizationUsage).values({
      id: "orgu_chat_usage",
      organizationId: currentOrganization.id,
      logsRetentionDays: 30,
      tracesRetentionDays: 30,
      metricsRetentionDays: 30,
      currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1_000),
      currentPeriodEnd: new Date(Date.now() + 29 * 24 * 60 * 60 * 1_000),
      ingestLimitBytes: 150 * Math.pow(1024, 3),
      chatCreditsIncluded: 1_200_000,
    });
  });

  afterAll(async () => {
    if (container) await stopPostgresContainer(container);
  });

  test("reports the included plan allowance before any usage", async () => {
    const usage = await service.getUsage({
      organizationId: "org_chat_usage",
    });
    expect(usage).toMatchObject({
      success: true,
      data: {
        includedCredits: 1_200_000,
        usedCredits: 0,
        remainingCredits: 1_200_000,
      },
    });
  });

  test("charges usage against the organization_usage counter", async () => {
    const result = await service.recordUsage(
      {
        inputTokens: 125,
        outputTokens: 75,
        totalTokens: 200,
      },
      { organizationId: "org_chat_usage" },
    );
    expect(result).toMatchObject({
      success: true,
      data: { credits: 575 },
    });

    const [usage] = await db
      .select({ chatCreditsUsed: organizationUsage.chatCreditsUsed })
      .from(organizationUsage)
      .where(eq(organizationUsage.organizationId, "org_chat_usage"));
    expect(usage.chatCreditsUsed).toBe(575);

    const currentUsage = await service.getUsage({
      organizationId: "org_chat_usage",
    });
    expect(currentUsage).toMatchObject({
      success: true,
      data: { usedCredits: 575, remainingCredits: 1_199_425 },
    });
  });

  test("records concurrent usage without losing increments", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.recordUsage(
          { totalTokens: 100 },
          { organizationId: "org_chat_usage" },
        ),
      ),
    );

    const usage = await service.getUsage({
      organizationId: "org_chat_usage",
    });
    expect(usage).toMatchObject({
      success: true,
      data: { usedCredits: 1_000, remainingCredits: 1_199_000 },
    });
  });

  test("blocks trial chats once the period allowance is exhausted", async () => {
    await db
      .update(organization)
      .set({ billingStatus: "trialing" })
      .where(eq(organization.id, "org_chat_usage"));
    await db
      .update(organizationUsage)
      .set({ chatCreditsUsed: 1_200_000 })
      .where(eq(organizationUsage.organizationId, "org_chat_usage"));

    const canStart = await service.canStart({
      organizationId: "org_chat_usage",
    });
    expect(canStart.success).toBe(false);
  });

  test("allows active subscriptions to use metered overage", async () => {
    await db
      .update(organizationUsage)
      .set({ chatCreditsUsed: 1_200_000 })
      .where(eq(organizationUsage.organizationId, "org_chat_usage"));

    const canStart = await service.canStart({
      organizationId: "org_chat_usage",
    });
    expect(canStart.success).toBe(true);
  });

  test("does not grant unmetered Scout usage to a legacy plan", async () => {
    await db
      .update(organization)
      .set({ billingPlan: "starter" })
      .where(eq(organization.id, "org_chat_usage"));
    await db
      .update(organizationUsage)
      .set({ chatCreditsUsed: 1_200_000 })
      .where(eq(organizationUsage.organizationId, "org_chat_usage"));

    const canStart = await service.canStart({
      organizationId: "org_chat_usage",
    });
    expect(canStart.success).toBe(false);
  });

  test("resets period usage when Stripe advances the billing period", async () => {
    await db
      .update(organizationUsage)
      .set({
        logsIngestedBytes: 10,
        tracesIngestedBytes: 20,
        metricsIngestedBytes: 30,
        chatCreditsUsed: 40,
        stripeIngestBytesReported: 60,
        stripeChatCreditsReported: 40,
        notified70At: new Date(),
      })
      .where(eq(organizationUsage.organizationId, "org_chat_usage"));

    const periodStart = Math.floor(Date.now() / 1_000) + 60;
    await createSyncStripeSubscriptionState({ db, config: { trialDays: 14 } })({
      organizationId: "org_chat_usage",
      plan: "pro",
      stripeSubscription: {
        status: "active",
        items: {
          data: [
            {
              current_period_start: periodStart,
              current_period_end: periodStart + 30 * 24 * 60 * 60,
            },
          ],
        },
      } as Stripe.Subscription,
    });

    const usage = await db.query.organizationUsage.findFirst({
      where: eq(organizationUsage.organizationId, "org_chat_usage"),
    });
    expect(usage).toMatchObject({
      logsIngestedBytes: 0,
      tracesIngestedBytes: 0,
      metricsIngestedBytes: 0,
      chatCreditsIncluded: 1_200_000,
      chatCreditsUsed: 0,
      stripeIngestBytesReported: 0,
      stripeChatCreditsReported: 0,
      notified70At: null,
    });
  });
});
