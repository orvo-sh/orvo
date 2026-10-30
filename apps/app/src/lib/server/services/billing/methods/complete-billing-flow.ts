import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import type Stripe from "stripe";
import { z } from "zod";

import { completeBillingFlowInputSchema } from "../schema";
import type { createGetCurrentSubscription } from "../shared";
import { readBillingReturnUrl } from "./shared";

const createCompleteBillingFlow =
  ({
    db,
    logger,
    stripe,
    isOrganizationOwner,
    reconcileSubscriptions,
    getCurrentSubscription,
  }: {
    db: DB;
    logger: Logger;
    stripe: Stripe;
    isOrganizationOwner: (
      organizationId: string,
      userId: string,
    ) => Promise<boolean>;
    reconcileSubscriptions: (context: {
      organizationId: string;
    }) => Promise<void>;
    getCurrentSubscription: ReturnType<typeof createGetCurrentSubscription>;
  }) =>
  async (
    input: z.input<typeof completeBillingFlowInputSchema>,
    context: { organizationId: string; userId: string; origin: string },
  ) => {
    const validated = completeBillingFlowInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);
    try {
      if (
        !(await isOrganizationOwner(context.organizationId, context.userId))
      ) {
        return err("Only organization owners can manage billing.");
      }
      const currentApp = await db.query.app.findFirst({
        where: ({ id, organizationId }, { and, eq }) =>
          and(
            eq(id, validated.data.appId),
            eq(organizationId, context.organizationId),
          ),
      });
      if (!currentApp) return err("App not found.");
      const returnUrl = readBillingReturnUrl({
        ...validated.data,
        origin: context.origin,
      });
      if (!returnUrl) return err("Invalid billing return path.");

      // A redirect is not evidence of payment. Read Stripe before updating access,
      // including when the webhook has not arrived yet.
      await reconcileSubscriptions({ organizationId: context.organizationId });
      const currentSubscription = await getCurrentSubscription(
        context.organizationId,
      );
      let paymentMethodId: string | undefined;
      if (
        validated.data.paymentMethodUpdated &&
        currentSubscription?.stripeSubscriptionId &&
        currentSubscription.stripeCustomerId &&
        !["canceled", "incomplete_expired"].includes(currentSubscription.status)
      ) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          currentSubscription.stripeSubscriptionId,
        );
        // Managed Payments only permits customers to change the subscription's
        // payment method through the portal, not through our API credentials.
        if (!stripeSubscription.managed_payments?.enabled) {
          const customer = await stripe.customers.retrieve(
            currentSubscription.stripeCustomerId,
          );
          if (
            !customer.deleted &&
            customer.invoice_settings.default_payment_method
          ) {
            paymentMethodId =
              typeof customer.invoice_settings.default_payment_method ===
              "string"
                ? customer.invoice_settings.default_payment_method
                : customer.invoice_settings.default_payment_method.id;
            await stripe.subscriptions.update(
              currentSubscription.stripeSubscriptionId,
              {
                default_payment_method: paymentMethodId,
              },
            );
          }
        }
      }
      if (
        currentSubscription?.stripeSubscriptionId &&
        ["past_due", "unpaid", "incomplete"].includes(
          currentSubscription.status,
        )
      ) {
        const subscription = await stripe.subscriptions.retrieve(
          currentSubscription.stripeSubscriptionId,
          { expand: ["latest_invoice"] },
        );
        const invoice =
          typeof subscription.latest_invoice === "string"
            ? await stripe.invoices.retrieve(subscription.latest_invoice)
            : subscription.latest_invoice;
        // Let Stripe collect the existing invoice and handle authentication.
        // Do not start another subscription or charge merely for saving a card.
        if (invoice?.status === "open" && invoice.hosted_invoice_url) {
          if (paymentMethodId) {
            await stripe.invoices.update(invoice.id, {
              default_payment_method: paymentMethodId,
            });
          }
          return ok({ url: invoice.hosted_invoice_url });
        }
      }
      return ok({ url: returnUrl.toString() });
    } catch (error) {
      recordError(error);
      logger.error(
        "completeBillingFlow: failed to refresh billing",
        error as Error,
      );
      return err(
        "Failed to confirm billing. Please return to billing settings and try again.",
      );
    }
  };

export { createCompleteBillingFlow };
