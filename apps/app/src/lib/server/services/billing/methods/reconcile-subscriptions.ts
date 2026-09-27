import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { eq, isNotNull, or } from "drizzle-orm";
import type Stripe from "stripe";

import type {
  createGetCurrentSubscription,
  createSyncStripeSubscriptionState,
} from "../shared";

const createReconcileSubscriptions =
  ({
    db,
    stripe,
    logger,
    config,
    getCurrentSubscription,
    syncStripeSubscriptionState,
  }: {
    db: DB;
    stripe: Stripe;
    logger: Logger;
    config: { proPriceId: string };
    getCurrentSubscription: ReturnType<typeof createGetCurrentSubscription>;
    syncStripeSubscriptionState: ReturnType<
      typeof createSyncStripeSubscriptionState
    >;
  }) =>
  async (context?: { organizationId: string }) => {
    const organizations = await db.query.organization.findMany({
      where: context
        ? eq(organization.id, context.organizationId)
        : or(
            isNotNull(organization.stripeCustomerId),
            isNotNull(organization.billingPlan),
          ),
    });
    const failures: unknown[] = [];

    for (const currentOrganization of organizations) {
      try {
        const currentSubscription = await getCurrentSubscription(
          currentOrganization.id,
        );
        const candidates: Stripe.Subscription[] = [];
        if (currentOrganization.stripeCustomerId) {
          for await (const candidate of stripe.subscriptions.list({
            customer: currentOrganization.stripeCustomerId,
            status: "all",
            limit: 100,
          })) {
            candidates.push(candidate);
          }
        } else if (currentSubscription?.stripeSubscriptionId) {
          candidates.push(
            await stripe.subscriptions.retrieve(
              currentSubscription.stripeSubscriptionId,
            ),
          );
        }

        // Shared or stale customer IDs must never grant another organization's plan.
        const ownedSubscriptions = candidates.filter(
          (candidate) =>
            candidate.metadata.referenceId === currentOrganization.id &&
            candidate.items.data.some(
              (item) => item.price.id === config.proPriceId,
            ),
        );
        const liveSubscriptions = ownedSubscriptions.filter((candidate) =>
          [
            "active",
            "trialing",
            "paused",
            "past_due",
            "unpaid",
            "incomplete",
          ].includes(candidate.status),
        );
        if (liveSubscriptions.length > 1) {
          throw new Error(
            "Multiple Stripe subscriptions belong to this organization.",
          );
        }
        const stripeSubscription =
          liveSubscriptions[0] ??
          ownedSubscriptions.find(
            (candidate) =>
              candidate.id === currentSubscription?.stripeSubscriptionId,
          ) ??
          ownedSubscriptions.sort((a, b) => b.created - a.created)[0];

        if (!stripeSubscription) {
          if (currentSubscription || currentOrganization.billingPlan) {
            throw new Error(
              "No Stripe subscription with matching organization metadata and price.",
            );
          }
          continue;
        }

        await syncStripeSubscriptionState({
          organizationId: currentOrganization.id,
          plan: "pro",
          stripeSubscription,
        });
      } catch (error) {
        recordError(error);
        logger
          .child("BillingReconciliation", {
            organizationId: currentOrganization.id,
          })
          .error(
            "reconcileSubscriptions: failed to reconcile organization",
            error as Error,
          );
        failures.push(error);
      }
    }

    if (failures.length) {
      throw new AggregateError(
        failures,
        "Failed to reconcile Stripe subscriptions.",
      );
    }
  };

export { createReconcileSubscriptions };
