import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import type Stripe from "stripe";

import type { createGetCurrentSubscription } from "../shared";

const createGetBillingState =
  ({
    db,
    logger,
    stripe,
    getCurrentSubscription,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    getCurrentSubscription: ReturnType<typeof createGetCurrentSubscription>;
  }) =>
  async (context: { organizationId: string }) => {
    try {
      const [currentOrganization, currentSubscription] = await Promise.all([
        db.query.organization.findFirst({
          columns: {
            billingPlan: true,
            billingStatus: true,
            stripeCustomerId: true,
          },
          with: {
            usage: {
              columns: {
                createdAt: false,
                id: false,
                organizationId: false,
                updatedAt: false,
              },
            },
          },
          where: ({ id }, { eq }) => eq(id, context.organizationId),
        }),
        getCurrentSubscription(context.organizationId),
      ]);

      if (!currentOrganization) {
        return err("No organization found.");
      }

      const billingStatus =
        currentSubscription?.status ?? currentOrganization.billingStatus;
      let hasPaymentMethod: boolean | null = null;
      const stripeCustomerId =
        currentSubscription?.stripeCustomerId ??
        currentOrganization.stripeCustomerId;

      if (billingStatus === "trialing") {
        if (!stripeCustomerId) {
          hasPaymentMethod = false;
        } else {
          try {
            const paymentMethods = await stripe.paymentMethods.list({
              customer: stripeCustomerId,
              limit: 1,
            });
            hasPaymentMethod = paymentMethods.data.length > 0;
          } catch (error) {
            recordError(error);
            logger.error(
              "getBillingState: failed to check Stripe payment methods",
              error as Error,
            );
          }
        }
      }

      return ok({
        billingPlan: currentOrganization.billingPlan,
        billingStatus,
        hasPaymentMethod,
        trialStart: currentSubscription?.trialStart ?? null,
        trialEnd: currentSubscription?.trialEnd ?? null,
        chatUsage: currentOrganization.usage
          ? {
              includedCredits: currentOrganization.usage.chatCreditsIncluded,
              usedCredits: currentOrganization.usage.chatCreditsUsed,
              remainingCredits: Math.max(
                0,
                currentOrganization.usage.chatCreditsIncluded -
                  currentOrganization.usage.chatCreditsUsed,
              ),
              periodEnd: currentOrganization.usage.currentPeriodEnd,
            }
          : null,
        ...currentOrganization.usage,
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to get billing state", error as Error);
      return err("Failed to get billing state");
    }
  };

export { createGetBillingState };
