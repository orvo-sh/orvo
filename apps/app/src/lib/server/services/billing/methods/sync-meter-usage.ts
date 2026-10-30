import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organizationUsage, subscription } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import type { createSyncOverageItems } from "./sync-overage-items";
import type { createReportMeterUsage } from "./report-meter-usage";

const createSyncMeterUsage =
  ({
    db,
    logger,
    stripe,
    syncOverageItems,
    reportMeterUsage,
    reconcileSubscriptions,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    reportMeterUsage: ReturnType<typeof createReportMeterUsage>;
    syncOverageItems: ReturnType<typeof createSyncOverageItems>;
    reconcileSubscriptions: (context: {
      organizationId: string;
    }) => Promise<void>;
  }) =>
  async () => {
    try {
      const organizations = await db.query.organizationUsage.findMany({
        columns: { organizationId: true },
      });
      for (const row of organizations) {
        // Refresh periods before removing settled disabled items or reporting
        // cumulative usage. Never report the previous period into a new one.
        await reconcileSubscriptions({ organizationId: row.organizationId });
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${row.organizationId}))`,
          );
          await tx.execute(
            sql`select id from organization_usage where organization_id = ${row.organizationId} for update`,
          );
          const [usage, currentSubscription] = await Promise.all([
            tx.query.organizationUsage.findFirst({
              where: eq(organizationUsage.organizationId, row.organizationId),
            }),
            tx.query.subscription.findFirst({
              where: and(
                eq(subscription.referenceId, row.organizationId),
                eq(subscription.status, "active"),
              ),
            }),
          ]);
          if (
            !usage ||
            !currentSubscription?.stripeSubscriptionId ||
            !currentSubscription.stripeCustomerId
          )
            return;
          const current = await stripe.subscriptions.retrieve(
            currentSubscription.stripeSubscriptionId,
          );
          if (current.status !== "active") return;
          const updated = await syncOverageItems({
            organizationId: row.organizationId,
            stripeSubscription: current,
            usage,
          });
          await reportMeterUsage(
            {
              organizationId: row.organizationId,
              customerId: currentSubscription.stripeCustomerId,
              usage,
              stripeSubscription: updated,
              previousItemIds: current.items.data.map((item) => item.id),
            },
            tx,
          );
        });
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
