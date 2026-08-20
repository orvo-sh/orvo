import { recordError } from "$lib/instrumentation";
import type { Subscription } from "@better-auth/stripe";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import Stripe from "stripe";

const createOnSubscriptionCreated =
  ({
    logger,
    stripe,
    syncStripeSubscriptionState,
  }: {
    logger: Logger;
    stripe: Stripe;
    syncStripeSubscriptionState: (context: {
      organizationId: string;
      plan: "pro";
      stripeSubscription: Stripe.Subscription;
    }) => Promise<void>;
  }) =>
  async (subscription: Subscription) => {
    try {
      if (subscription.plan !== "pro") {
        return err("Subscription plan is not supported.");
      }

      if (!subscription.stripeSubscriptionId) {
        return err("Subscription is missing a Stripe subscription id.");
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );

      await syncStripeSubscriptionState({
        organizationId: subscription.referenceId,
        plan: "pro",
        stripeSubscription,
      });

      return ok(null);
    } catch (error) {
      recordError(error);
      logger.error("Failed to sync subscription", error as Error);
      return err("Failed to activate subscription.");
    }
  };

export { createOnSubscriptionCreated };
