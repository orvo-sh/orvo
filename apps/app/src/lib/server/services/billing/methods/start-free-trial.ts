import { recordError } from "$lib/instrumentation";
import type { Auth } from "$lib/server/auth";
import type { DB } from "@repo/db";
import { organization, subscription } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, lt, sql } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";

import { startFreeTrialInputSchema } from "../schema";
import { readRedirectUrl } from "../shared";

const createStartFreeTrial =
  ({
    db,
    logger,
    stripe,
    isOrganizationOwner,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    isOrganizationOwner: (
      organizationId: string,
      userId: string,
    ) => Promise<boolean>;
  }) =>
  async (
    input: z.input<typeof startFreeTrialInputSchema>,
    context: {
      organizationId: string;
      userId: string;
      headers: Headers;
      origin: string;
      authService: Auth;
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

      return await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${context.organizationId}))`,
        );

        const currentOrganization = await tx.query.organization.findFirst({
          columns: { stripeCustomerId: true },
          where: eq(organization.id, context.organizationId),
        });
        if (!currentOrganization) {
          return err("Organization not found.");
        }

        if (currentOrganization.stripeCustomerId) {
          let stripeSubscriptions: Stripe.ApiList<Stripe.Subscription> | null =
            null;
          try {
            stripeSubscriptions = await stripe.subscriptions.list({
              customer: currentOrganization.stripeCustomerId,
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
              lt(
                subscription.updatedAt,
                new Date(Date.now() - 24 * 60 * 60 * 1_000),
              ),
            ),
          );

        const result = await context.authService.api.upgradeSubscription({
          body: {
            plan: validated.data.plan,
            customerType: "organization",
            referenceId: context.organizationId,
            successUrl: new URL(
              "/apps/new?checkout=success",
              context.origin,
            ).toString(),
            cancelUrl: new URL(
              "/organizations/plan?checkout=cancelled",
              context.origin,
            ).toString(),
            returnUrl: new URL(
              "/organizations/plan",
              context.origin,
            ).toString(),
            disableRedirect: true,
          },
          headers: context.headers,
        });

        const checkoutUrl = readRedirectUrl(result);
        if (!checkoutUrl) {
          return err("Failed to open billing checkout.");
        }

        return ok({ url: checkoutUrl });
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "startFreeTrial: failed to open billing checkout",
        error as Error,
      );
      return err("Failed to open billing checkout.");
    }
  };

export { createStartFreeTrial };
