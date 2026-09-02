import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization, subscription } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";

import { startFreeTrialInputSchema } from "../schema";

const createStartFreeTrial =
  ({
    db,
    logger,
    stripe,
    config,
    isOrganizationOwner,
    syncStripeSubscriptionState,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    config: {
      proPriceId: string;
      ingestOveragePriceId: string;
      scoutOveragePriceId: string;
      trialDays: number;
    };
    isOrganizationOwner: (
      organizationId: string,
      userId: string,
    ) => Promise<boolean>;
    syncStripeSubscriptionState: (context: {
      organizationId: string;
      plan: "pro";
      stripeSubscription: Stripe.Subscription;
    }) => Promise<void>;
  }) =>
  async (
    input: z.input<typeof startFreeTrialInputSchema>,
    context: {
      organizationId: string;
      userId: string;
    },
  ) => {
    const validated = startFreeTrialInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      if (
        !(await isOrganizationOwner(context.organizationId, context.userId))
      ) {
        return err("Only organization owners can manage billing.");
      }

      const result = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${context.organizationId}))`,
        );

        const currentOrganization = await tx.query.organization.findFirst({
          columns: { id: true, name: true, stripeCustomerId: true },
          where: eq(organization.id, context.organizationId),
        });
        if (!currentOrganization) {
          return err("Organization not found.");
        }

        let stripeCustomerId = currentOrganization.stripeCustomerId;
        if (stripeCustomerId) {
          let stripeSubscriptions: Stripe.ApiList<Stripe.Subscription> | null =
            null;
          try {
            stripeSubscriptions = await stripe.subscriptions.list({
              customer: stripeCustomerId,
              status: "all",
              limit: 100,
            });
          } catch (error) {
            if (
              typeof error !== "object" ||
              error === null ||
              !("code" in error) ||
              error.code !== "resource_missing"
            ) {
              throw error;
            }

            await tx
              .update(organization)
              .set({ stripeCustomerId: null })
              .where(eq(organization.id, context.organizationId));
            stripeCustomerId = null;
          }

          if (
            stripeSubscriptions?.data.some((candidate) =>
              [
                "active",
                "trialing",
                "paused",
                "past_due",
                "unpaid",
                "incomplete",
              ].includes(candidate.status),
            )
          ) {
            return err("This organization already has a subscription.");
          }
        }

        await tx
          .delete(subscription)
          .where(
            and(
              eq(subscription.referenceId, context.organizationId),
              eq(subscription.status, "incomplete"),
            ),
          );

        if (!stripeCustomerId) {
          const stripeCustomer = await stripe.customers.create(
            {
              name: currentOrganization.name,
              metadata: {
                organizationId: currentOrganization.id,
                customerType: "organization",
              },
            },
            {
              idempotencyKey: `orvo-customer-${currentOrganization.id}`,
            },
          );

          stripeCustomerId = stripeCustomer.id;

          await tx
            .update(organization)
            .set({ stripeCustomerId })
            .where(eq(organization.id, currentOrganization.id));
        }

        const stripeSubscription = await stripe.subscriptions.create(
          {
            customer: stripeCustomerId,
            items: [
              { price: config.proPriceId },
              { price: config.ingestOveragePriceId },
              { price: config.scoutOveragePriceId },
            ],
            trial_period_days: config.trialDays,
            metadata: {
              userId: context.userId,
              referenceId: context.organizationId,
            },
            trial_settings: {
              end_behavior: {
                missing_payment_method: "cancel",
              },
            },
          },
          {
            idempotencyKey: `orvo-subscription-trial-${context.organizationId}`,
          },
        );

        return ok({ stripeSubscription });
      });

      if (!result.success) return result;

      await syncStripeSubscriptionState({
        organizationId: context.organizationId,
        plan: validated.data.plan,
        stripeSubscription: result.data.stripeSubscription,
      });

      return ok({ id: result.data.stripeSubscription.id });
    } catch (error) {
      recordError(error);
      logger.error(
        "startFreeTrial: failed to start free trial",
        error as Error,
      );
      return err("Failed to start the free trial.");
    }
  };

export { createStartFreeTrial };
