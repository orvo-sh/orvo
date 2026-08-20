import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization, organizationUsage, subscription } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

const createSyncMeterUsage =
  ({
    db,
    logger,
    stripe,
    config,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    config: { ingestEventName: string; scoutEventName: string };
  }) =>
  async () => {
    try {
      const rows = await db
        .select({
          usageId: organizationUsage.id,
          organizationId: organizationUsage.organizationId,
          periodStart: organizationUsage.currentPeriodStart,
          logsIngestedBytes: organizationUsage.logsIngestedBytes,
          tracesIngestedBytes: organizationUsage.tracesIngestedBytes,
          metricsIngestedBytes: organizationUsage.metricsIngestedBytes,
          chatCredits: organizationUsage.chatCreditsUsed,
          ingestBytesReported: organizationUsage.stripeIngestBytesReported,
          chatCreditsReported: organizationUsage.stripeChatCreditsReported,
          organizationCustomerId: organization.stripeCustomerId,
          subscriptionCustomerId: subscription.stripeCustomerId,
        })
        .from(organizationUsage)
        .innerJoin(
          organization,
          eq(organization.id, organizationUsage.organizationId),
        )
        .leftJoin(
          subscription,
          and(
            eq(subscription.referenceId, organizationUsage.organizationId),
            eq(subscription.plan, "pro"),
            inArray(subscription.status, ["active", "trialing"]),
          ),
        );

      for (const row of rows) {
      const stripeCustomerId =
        row.subscriptionCustomerId ?? row.organizationCustomerId;
        if (!stripeCustomerId) continue;

        const ingestBytes =
          row.logsIngestedBytes +
          row.tracesIngestedBytes +
          row.metricsIngestedBytes;
        const periodStart = Math.floor(row.periodStart.getTime() / 1_000);

        if (ingestBytes !== row.ingestBytesReported) {
          await stripe.billing.meterEvents.create({
            event_name: config.ingestEventName,
            identifier: `orvo_ingest_${row.organizationId}_${periodStart}_${ingestBytes}`,
            payload: {
              stripe_customer_id: stripeCustomerId,
              value: String(ingestBytes),
            },
          });
          await db
            .update(organizationUsage)
            .set({ stripeIngestBytesReported: ingestBytes })
            .where(eq(organizationUsage.id, row.usageId));
        }

        if (row.chatCredits !== row.chatCreditsReported) {
          await stripe.billing.meterEvents.create({
            event_name: config.scoutEventName,
            identifier: `orvo_scout_${row.organizationId}_${periodStart}_${row.chatCredits}`,
            payload: {
              stripe_customer_id: stripeCustomerId,
              value: String(row.chatCredits),
            },
          });
          await db
            .update(organizationUsage)
            .set({ stripeChatCreditsReported: row.chatCredits })
            .where(eq(organizationUsage.id, row.usageId));
        }
      }
    } catch (error) {
      recordError(error);
      logger.error(
        "syncMeterUsage: failed to report Stripe usage",
        error as Error,
      );
      throw error;
    }
  };

export { createSyncMeterUsage };
