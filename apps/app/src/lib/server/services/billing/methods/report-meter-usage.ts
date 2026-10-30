import type { DB } from "@repo/db";
import { organizationUsage } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

const createReportMeterUsage =
  ({
    stripe,
    config,
  }: {
    stripe: Stripe;
    config: {
      ingestEventName: string;
      scoutEventName: string;
      ingestOveragePriceId: string;
      scoutOveragePriceId: string;
    };
  }) =>
  async (
    input: {
      organizationId: string;
      customerId: string;
      usage: typeof organizationUsage.$inferSelect;
      stripeSubscription: Stripe.Subscription;
      previousItemIds: string[];
    },
    tx: Pick<DB, "update">,
  ) => {
    const periodStart = Math.floor(
      input.usage.currentPeriodStart.getTime() / 1000,
    );
    for (const meter of [
      {
        price: config.ingestOveragePriceId,
        event: config.ingestEventName,
        prefix: "ingest",
        value:
          input.usage.logsIngestedBytes +
          input.usage.metricsIngestedBytes +
          input.usage.tracesIngestedBytes,
        reported: input.usage.stripeIngestBytesReported,
        column: "stripeIngestBytesReported" as const,
      },
      {
        price: config.scoutOveragePriceId,
        event: config.scoutEventName,
        prefix: "scout",
        value: input.usage.chatCreditsUsed,
        reported: input.usage.stripeChatCreditsReported,
        column: "stripeChatCreditsReported" as const,
      },
    ]) {
      const item = input.stripeSubscription.items.data.find(
        (item) => item.price.id === meter.price,
      );
      if (
        !item ||
        (input.previousItemIds.includes(item.id) &&
          meter.value === meter.reported)
      )
        continue;
      const value = Math.max(
        0,
        meter.value -
          (item.metadata?.orvo_usage_offset_period === String(periodStart)
            ? Number(item.metadata.orvo_usage_offset ?? 0)
            : 0),
      );
      // These meters aggregate the last cumulative value. Include the consumed
      // free tier in every snapshot, so enabling mid-cycle doesn't grant it twice.
      await stripe.billing.meterEvents.create({
        event_name: meter.event,
        identifier: `orvo_${meter.prefix}_${input.organizationId}_${periodStart}_${item.id}_${meter.value}`,
        payload: {
          stripe_customer_id: input.customerId,
          value: String(value),
        },
      });
      await tx
        .update(organizationUsage)
        .set({ [meter.column]: meter.value })
        .where(eq(organizationUsage.id, input.usage.id));
    }
  };

export { createReportMeterUsage };
