import type Stripe from "stripe";

const createSyncOverageItems =
  ({
    stripe,
    config,
  }: {
    stripe: Stripe;
    config: {
      proPriceId: string;
      ingestOveragePriceId: string;
      scoutOveragePriceId: string;
    };
  }) =>
  async (input: {
    organizationId: string;
    stripeSubscription: Stripe.Subscription;
    usage: {
      currentPeriodStart: Date;
      ingestOverageEnabled: boolean;
      scoutOverageEnabled: boolean;
      logsIngestedBytes: number;
      tracesIngestedBytes: number;
      metricsIngestedBytes: number;
      ingestLimitBytes: number;
      chatCreditsUsed: number;
      chatCreditsIncluded: number;
    };
  }) => {
    const base = input.stripeSubscription.items.data.find(
      (item) => item.price.id === config.proPriceId,
    );
    if (
      input.stripeSubscription.metadata.referenceId !== input.organizationId ||
      !base
    ) {
      throw new Error("Subscription ownership or plan could not be verified.");
    }
    if (
      base.current_period_start * 1000 !==
      input.usage.currentPeriodStart.getTime()
    ) {
      throw new Error(
        "Billing period is being refreshed. Please try again shortly.",
      );
    }
    const items: Stripe.SubscriptionUpdateParams.Item[] = [];
    for (const overage of [
      {
        price: config.ingestOveragePriceId,
        enabled: input.usage.ingestOverageEnabled,
        used:
          input.usage.logsIngestedBytes +
          input.usage.tracesIngestedBytes +
          input.usage.metricsIngestedBytes,
        included: input.usage.ingestLimitBytes,
      },
      {
        price: config.scoutOveragePriceId,
        enabled: input.usage.scoutOverageEnabled,
        used: input.usage.chatCreditsUsed,
        included: input.usage.chatCreditsIncluded,
      },
    ]) {
      const existing = input.stripeSubscription.items.data.find(
        (item) => item.price.id === overage.price,
      );
      if (overage.enabled && !existing)
        items.push({
          price: overage.price,
          ...(overage.used > overage.included
            ? {
                metadata: {
                  orvo_usage_offset: String(overage.used - overage.included),
                  orvo_usage_offset_period: String(base.current_period_start),
                },
              }
            : {}),
        });
      // Keep an existing item until renewal if it has accrued a charge. Removing
      // and re-adding it mid-cycle would lose usage or repeat the free tier.
      if (
        !overage.enabled &&
        existing &&
        overage.used -
          (existing.metadata?.orvo_usage_offset_period ===
          String(base.current_period_start)
            ? Number(existing.metadata.orvo_usage_offset ?? 0)
            : 0) <=
          overage.included
      )
        items.push({ id: existing.id, deleted: true });
    }
    return items.length
      ? stripe.subscriptions.update(input.stripeSubscription.id, {
          items,
          proration_behavior: "none",
        })
      : input.stripeSubscription;
  };

export { createSyncOverageItems };
