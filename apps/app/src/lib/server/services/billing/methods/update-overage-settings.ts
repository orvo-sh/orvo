import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organizationUsage } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, sql } from "drizzle-orm";
import { subscription } from "@repo/db/schema";
import type Stripe from "stripe";
import type { createSyncOverageItems } from "./sync-overage-items";
import type { createReportMeterUsage } from "./report-meter-usage";
import { z } from "zod";

import { updateOverageSettingsInputSchema } from "../schema";

const createUpdateOverageSettings =
  ({
    db,
    logger,
    isOrganizationOwner,
    stripe,
    syncOverageItems,
    reconcileSubscriptions,
    config,
    reportMeterUsage,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    reportMeterUsage: ReturnType<typeof createReportMeterUsage>;
    config: { ingestOveragePriceId: string; scoutOveragePriceId: string };
    syncOverageItems: ReturnType<typeof createSyncOverageItems>;
    reconcileSubscriptions: (context: {
      organizationId: string;
    }) => Promise<void>;
    isOrganizationOwner: (
      organizationId: string,
      userId: string,
    ) => Promise<boolean>;
  }) =>
  async (
    input: z.input<typeof updateOverageSettingsInputSchema>,
    context: { organizationId: string; userId: string },
  ) => {
    const validated = updateOverageSettingsInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      if (
        !(await isOrganizationOwner(context.organizationId, context.userId))
      ) {
        return err("Only organization owners can manage overages.");
      }

      await reconcileSubscriptions({ organizationId: context.organizationId });
      return await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${context.organizationId}))`,
        );
        // Usage reservations use this same row lock. Freeze counters while
        // changing billing items and the permission to consume overage.
        await tx.execute(
          sql`select id from organization_usage where organization_id = ${context.organizationId} for update`,
        );
        const [usage, currentSubscription] = await Promise.all([
          tx.query.organizationUsage.findFirst({
            where: eq(organizationUsage.organizationId, context.organizationId),
          }),
          tx.query.subscription.findFirst({
            where: and(
              eq(subscription.referenceId, context.organizationId),
              eq(subscription.status, "active"),
            ),
          }),
        ]);
        if (!usage) return err("Organization usage was not found.");
        if (
          !currentSubscription?.stripeSubscriptionId ||
          currentSubscription.plan !== "pro"
        ) {
          return err(
            "Overages can only be enabled for an active Pro subscription.",
          );
        }
        const stripeSubscription = await stripe.subscriptions.retrieve(
          currentSubscription.stripeSubscriptionId,
        );
        if (stripeSubscription.status !== "active")
          return err(
            "Overages can only be enabled for an active Pro subscription.",
          );
        if (!currentSubscription.stripeCustomerId)
          return err("Billing customer was not found.");
        // Flush accrued usage before switching off either permission. Once
        // disabled, quota guardrails stop further usage beyond the allowance.
        if (
          (usage.ingestOverageEnabled &&
            !validated.data.ingestOverageEnabled) ||
          (usage.scoutOverageEnabled && !validated.data.scoutOverageEnabled)
        ) {
          await reportMeterUsage(
            {
              organizationId: context.organizationId,
              customerId: currentSubscription.stripeCustomerId,
              usage,
              stripeSubscription,
              previousItemIds: stripeSubscription.items.data.map(
                (item) => item.id,
              ),
            },
            tx,
          );
        }
        await syncOverageItems({
          organizationId: context.organizationId,
          stripeSubscription,
          usage: { ...usage, ...validated.data },
        });
        await tx
          .update(organizationUsage)
          .set({
            ...validated.data,
            ...(validated.data.ingestOverageEnabled &&
            !stripeSubscription.items.data.some(
              (item) => item.price.id === config.ingestOveragePriceId,
            )
              ? { stripeIngestBytesReported: 0 }
              : {}),
            ...(validated.data.scoutOverageEnabled &&
            !stripeSubscription.items.data.some(
              (item) => item.price.id === config.scoutOveragePriceId,
            )
              ? { stripeChatCreditsReported: 0 }
              : {}),
          })
          .where(eq(organizationUsage.organizationId, context.organizationId));
        return ok(null);
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "updateOverageSettings: failed to update overage settings",
        error as Error,
      );
      return err("Failed to update overage settings.");
    }
  };

export { createUpdateOverageSettings };
