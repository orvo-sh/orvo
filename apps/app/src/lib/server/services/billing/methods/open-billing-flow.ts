import type { DB } from "@repo/db";
import { err, ok } from "@repo/utils";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { createHash } from "node:crypto";

const createOpenBillingFlow =
  ({
    db,
    stripe,
    config,
  }: {
    db: DB;
    stripe: Stripe;
    config: {
      proPriceId: string;
      ingestOveragePriceId: string;
      scoutOveragePriceId: string;
    };
  }) =>
  async (
    input: {
      returnUrl: URL;
      appId: string;
    },
    context: { organizationId: string; userId: string },
  ) =>
    db.transaction(async (tx) => {
      // Serialize recovery attempts with trial creation for this organization.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${context.organizationId}))`,
      );
      const currentOrganization = await tx.query.organization.findFirst({
        columns: { stripeCustomerId: true },
        with: { usage: true },
        where: ({ id }, { eq }) => eq(id, context.organizationId),
      });
      if (!currentOrganization?.stripeCustomerId) {
        return err("No billing customer found for this organization.");
      }
      const customer = currentOrganization.stripeCustomerId;
      const subscriptions: Stripe.Subscription[] = [];
      for await (const candidate of stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      })) {
        subscriptions.push(candidate);
      }
      const live = subscriptions.filter(
        (candidate) =>
          !["canceled", "incomplete_expired"].includes(candidate.status),
      );
      if (
        live.length > 1 ||
        live.some(
          (candidate) =>
            candidate.metadata.referenceId !== context.organizationId ||
            !candidate.items.data.some(
              (item) => item.price.id === config.proPriceId,
            ),
        )
      ) {
        return err(
          "The current subscription could not be verified. Contact support.",
        );
      }

      const callback = new URL("/api/billing/return", input.returnUrl.origin);
      callback.searchParams.set("appId", input.appId);
      callback.searchParams.set(
        "returnPath",
        input.returnUrl.pathname +
          input.returnUrl.search +
          input.returnUrl.hash,
      );
      const existing = live[0];
      if (existing) {
        callback.searchParams.set("paymentMethodUpdated", "1");
        if (
          existing.status === "trialing" &&
          existing.trial_end != null &&
          existing.trial_end * 1000 <= Date.now()
        ) {
          return err(
            "Your trial is being finalized. Please try again in a moment.",
          );
        }
        // A paused subscription needs an explicit resume operation; keep it in
        // the full portal rather than accidentally creating another subscription.
        const session = await stripe.billingPortal.sessions.create({
          customer,
          return_url: input.returnUrl.toString(),
          ...(existing.status === "paused"
            ? {}
            : {
                flow_data: {
                  type: "payment_method_update" as const,
                  after_completion: {
                    type: "redirect" as const,
                    redirect: { return_url: callback.toString() },
                  },
                },
              }),
        });
        return ok({ url: session.url });
      }

      const sessions: Stripe.Checkout.Session[] = [];
      for await (const session of stripe.checkout.sessions.list({
        customer,
        limit: 100,
      })) {
        if (
          session.mode === "subscription" &&
          session.metadata?.referenceId === context.organizationId
        ) {
          sessions.push(session);
        }
      }
      // A just-completed Checkout can become visible before the subscription
      // list catches up. Never create another payable session in that window.
      for (const session of sessions.filter(
        (session) => session.status === "complete",
      )) {
        if (!session.subscription) continue;
        if (
          subscriptions.some(
            (candidate) => candidate.id === session.subscription,
          )
        )
          continue;
        const subscription =
          typeof session.subscription === "string"
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;
        if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
          for (const open of sessions.filter(
            (candidate) => candidate.status === "open",
          )) {
            await stripe.checkout.sessions.expire(open.id);
          }
          return err(
            "Your subscription is being updated. Refresh the page in a moment.",
          );
        }
      }

      const reusableSession = sessions.find(
        (session) =>
          session.status === "open" &&
          session.managed_payments?.enabled === true &&
          session.metadata?.ingestOverageEnabled ===
            String(currentOrganization.usage?.ingestOverageEnabled ?? false) &&
          session.metadata?.scoutOverageEnabled ===
            String(currentOrganization.usage?.scoutOverageEnabled ?? false) &&
          session.success_url === callback.toString() &&
          session.url,
      );
      for (const session of sessions.filter(
        (candidate) =>
          candidate.status === "open" && candidate.id !== reusableSession?.id,
      )) {
        // Only one payable Checkout may remain open, including across tabs.
        await stripe.checkout.sessions.expire(session.id);
      }
      if (reusableSession?.url) return ok({ url: reusableSession.url });

      const checkoutParams = {
        mode: "subscription",
        managed_payments: { enabled: true },
        customer,
        client_reference_id: context.organizationId,
        line_items: [
          { price: config.proPriceId, quantity: 1 },
          ...(currentOrganization.usage?.ingestOverageEnabled
            ? [{ price: config.ingestOveragePriceId }]
            : []),
          ...(currentOrganization.usage?.scoutOverageEnabled
            ? [{ price: config.scoutOveragePriceId }]
            : []),
        ],
        // Recovery is paid immediately. Never grant a second trial.
        subscription_data: {
          metadata: {
            referenceId: context.organizationId,
            userId: context.userId,
          },
        },
        metadata: {
          referenceId: context.organizationId,
          ingestOverageEnabled: String(
            currentOrganization.usage?.ingestOverageEnabled ?? false,
          ),
          scoutOverageEnabled: String(
            currentOrganization.usage?.scoutOverageEnabled ?? false,
          ),
        },
        success_url: callback.toString(),
        cancel_url: input.returnUrl.toString(),
      } satisfies Stripe.Checkout.SessionCreateParams;
      const session = await stripe.checkout.sessions.create(checkoutParams, {
        idempotencyKey: `orvo-paid-checkout-${context.organizationId}-${sessions[0]?.id ?? subscriptions[0]?.id ?? "first"}-${createHash("sha256").update(JSON.stringify(checkoutParams)).digest("hex")}`,
      });
      return session.url
        ? ok({ url: session.url })
        : err("Failed to open subscription checkout.");
    });

export { createOpenBillingFlow };
