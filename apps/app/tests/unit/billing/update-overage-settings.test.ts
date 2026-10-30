import { createUpdateOverageSettings } from "$lib/server/services/billing/methods/update-overage-settings";
import { createSyncOverageItems } from "$lib/server/services/billing/methods/sync-overage-items";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("overage settings and Stripe items", () => {
  const findUsage = vi.fn();
  const findSubscription = vi.fn();
  const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
  const isOrganizationOwner = vi.fn();
  const retrieve = vi.fn();
  const update = vi.fn();
  const reportMeterUsage = vi.fn();
  const reconcileSubscriptions = vi.fn();
  const config = {
    proPriceId: "price_pro",
    ingestOveragePriceId: "price_ingest",
    scoutOveragePriceId: "price_scout",
  };
  const stripe = { subscriptions: { retrieve, update } };
  const tx = {
    execute: vi.fn(),
    query: {
      organizationUsage: { findFirst: findUsage },
      subscription: { findFirst: findSubscription },
    },
    update: vi.fn(() => ({ set })),
  };
  const save = createUpdateOverageSettings({
    db: { transaction: vi.fn((callback) => callback(tx)) } as never,
    logger: { error: vi.fn() } as never,
    stripe: stripe as never,
    config,
    isOrganizationOwner,
    reconcileSubscriptions,
    reportMeterUsage,
    syncOverageItems: createSyncOverageItems({
      stripe: stripe as never,
      config,
    }),
  });
  const input = {
    ingestOverageEnabled: true,
    ingestOverageBudgetCents: 2500,
    scoutOverageEnabled: true,
    scoutOverageBudgetCents: null,
  };
  const context = { organizationId: "org_billing", userId: "usr_owner" };
  const base = {
    id: "si_pro",
    price: { id: "price_pro" },
    current_period_start: 1000,
  };
  const ingest = { id: "si_ingest", price: { id: "price_ingest" } };
  const scout = { id: "si_scout", price: { id: "price_scout" } };
  const subscription = (items = [base] as unknown[]) => ({
    id: "sub_billing",
    status: "active",
    metadata: { referenceId: "org_billing" },
    items: { data: items },
  });
  const usage = {
    currentPeriodStart: new Date(1000000),
    ingestOverageEnabled: false,
    scoutOverageEnabled: false,
    logsIngestedBytes: 50,
    metricsIngestedBytes: 0,
    tracesIngestedBytes: 0,
    ingestLimitBytes: 100,
    chatCreditsUsed: 50,
    chatCreditsIncluded: 100,
    stripeIngestBytesReported: 50,
    stripeChatCreditsReported: 50,
  };
  beforeEach(() => {
    vi.resetAllMocks();
    isOrganizationOwner.mockResolvedValue(true);
    findUsage.mockResolvedValue({ ...usage });
    findSubscription.mockResolvedValue({
      plan: "pro",
      stripeSubscriptionId: "sub_billing",
      stripeCustomerId: "cus_billing",
    });
    retrieve.mockResolvedValue(subscription());
    update.mockResolvedValue(subscription([base, ingest, scout]));
  });
  test("enabling adds optional prices without prorating or resetting the billing anchor", async () => {
    expect(await save(input, context)).toEqual({ success: true, data: null });
    expect(update).toHaveBeenCalledWith("sub_billing", {
      items: [{ price: "price_ingest" }, { price: "price_scout" }],
      proration_behavior: "none",
    });
    expect(set).toHaveBeenCalledWith({
      ...input,
      stripeIngestBytesReported: 0,
      stripeChatCreditsReported: 0,
    });
  });
  test("disabling unused overages removes their Stripe items", async () => {
    retrieve.mockResolvedValue(subscription([base, ingest, scout]));
    await save(
      { ...input, ingestOverageEnabled: false, scoutOverageEnabled: false },
      context,
    );
    expect(update).toHaveBeenCalledWith("sub_billing", {
      items: [
        { id: "si_ingest", deleted: true },
        { id: "si_scout", deleted: true },
      ],
      proration_behavior: "none",
    });
  });
  test("disabling flushes incurred charges and retains their item until renewal", async () => {
    retrieve.mockResolvedValue(subscription([base, ingest]));
    findUsage.mockResolvedValue({
      ...usage,
      ingestOverageEnabled: true,
      logsIngestedBytes: 150,
    });
    await save(
      { ...input, ingestOverageEnabled: false, scoutOverageEnabled: false },
      context,
    );
    expect(reportMeterUsage).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ ingestOverageEnabled: false }),
    );
  });
  test("re-enabling an item with accrued charges does not add it twice", async () => {
    retrieve.mockResolvedValue(subscription([base, ingest]));
    findUsage.mockResolvedValue({ ...usage, logsIngestedBytes: 150 });
    await save({ ...input, scoutOverageEnabled: false }, context);
    expect(update).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ ...input, scoutOverageEnabled: false });
  });
  test("Stripe failure does not enable overage consumption locally", async () => {
    update.mockRejectedValue(new Error("Stripe unavailable"));
    expect((await save(input, context)).success).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  test("does not charge for excess usage recorded before opt-in", async () => {
    findUsage.mockResolvedValue({ ...usage, chatCreditsUsed: 125 });
    await save({ ...input, ingestOverageEnabled: false }, context);
    expect(update).toHaveBeenCalledWith("sub_billing", {
      items: [
        {
          price: "price_scout",
          metadata: {
            orvo_usage_offset: "25",
            orvo_usage_offset_period: "1000",
          },
        },
      ],
      proration_behavior: "none",
    });
  });
  test("rejects non-owners", async () => {
    isOrganizationOwner.mockResolvedValue(false);
    expect((await save(input, context)).success).toBe(false);
    expect(reconcileSubscriptions).not.toHaveBeenCalled();
  });
  test("rejects trials and stale local active status", async () => {
    findSubscription.mockResolvedValue(undefined);
    expect((await save(input, context)).success).toBe(false);
    findSubscription.mockResolvedValue({
      plan: "pro",
      stripeSubscriptionId: "sub_billing",
    });
    retrieve.mockResolvedValue({ ...subscription(), status: "canceled" });
    expect((await save(input, context)).success).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });
  test("rejects a subscription belonging to another organization", async () => {
    retrieve.mockResolvedValue({
      ...subscription(),
      metadata: { referenceId: "org_other" },
    });
    expect((await save(input, context)).success).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  test("rejects a period mismatch to avoid reporting into the wrong cycle", async () => {
    findUsage.mockResolvedValue({ ...usage, currentPeriodStart: new Date(0) });
    expect((await save(input, context)).success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
