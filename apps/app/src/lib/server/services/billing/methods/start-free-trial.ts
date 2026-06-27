import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";

import { startFreeTrialInputSchema } from "../schema";

const createStartFreeTrial = ({
  db,
  logger,
  stripe,
  config,
  isOrganizationOwner,
  getCurrentSubscription,
  readStripePriceId,
  syncStripeSubscriptionState,
}: {
  db: DB;
  logger: Logger;
  stripe: Stripe;
  config: { trialDays: number };
  isOrganizationOwner: (organizationId: string, userId: string) => Promise<boolean>;
  getCurrentSubscription: (organizationId: string) => Promise<any>;
  readStripePriceId: (plan: "starter" | "pro") => string;
  syncStripeSubscriptionState: (context: {
    organizationId: string;
    plan: "starter" | "pro";
    stripeSubscription: Stripe.Subscription;
  }) => Promise<void>;
}) => async (
  input: z.input<typeof startFreeTrialInputSchema>,
  context: { organizationId: string; userId: string },
) => {
  const validated = startFreeTrialInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    if (!(await isOrganizationOwner(context.organizationId, context.userId))) {
      return err("Only organization owners can start a trial.");
    }

    const currentOrganization = await db.query.organization.findFirst({
      where: eq(organization.id, context.organizationId),
    });

    if (!currentOrganization) {
      return err("Organization not found.");
    }

    const currentSubscription = await getCurrentSubscription(context.organizationId);

    if (
      currentSubscription &&
      ["trialing", "active", "past_due", "paused", "unpaid"].includes(
        currentSubscription.status,
      )
    ) {
      return err("This organization already has a subscription.");
    }

    let stripeCustomerId = currentOrganization.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        name: currentOrganization.name,
        metadata: {
          organizationId: currentOrganization.id,
          customerType: "organization",
        },
      });

      stripeCustomerId = stripeCustomer.id;

      await db
        .update(organization)
        .set({ stripeCustomerId })
        .where(eq(organization.id, currentOrganization.id));
    }

    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: readStripePriceId(validated.data.plan) }],
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
    });

    await syncStripeSubscriptionState({
      organizationId: context.organizationId,
      plan: validated.data.plan,
      stripeSubscription,
    });

    return ok({ id: stripeSubscription.id });
  } catch (error) {
    recordError(error);
    logger.error("Failed to start free trial", error as Error);
    return err("Failed to start the free trial.");
  }
};

export { createStartFreeTrial };
