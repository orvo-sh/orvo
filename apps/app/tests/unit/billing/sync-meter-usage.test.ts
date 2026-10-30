import { createSyncMeterUsage } from "$lib/server/services/billing/methods/sync-meter-usage";
import { createSyncOverageItems } from "$lib/server/services/billing/methods/sync-overage-items";
import { createReportMeterUsage } from "$lib/server/services/billing/methods/report-meter-usage";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("optional overage meter synchronization", () => {
  const findUsage = vi.fn();
  const findSubscription = vi.fn();
  const createMeterEvent = vi.fn();
  const retrieve = vi.fn();
  const updateSubscription = vi.fn();
  const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
  const config = {
    proPriceId: "price_pro",
    ingestOveragePriceId: "price_ingest",
    scoutOveragePriceId: "price_scout",
    ingestEventName: "ingest_cumulative",
    scoutEventName: "scout_cumulative",
  };
  const stripe = {
    subscriptions: { retrieve, update: updateSubscription },
    billing: { meterEvents: { create: createMeterEvent } },
  };
  const tx = {
    execute: vi.fn(),
    query: {
      organizationUsage: { findFirst: findUsage },
      subscription: { findFirst: findSubscription },
    },
    update: vi.fn(() => ({ set })),
  };
  const sync = createSyncMeterUsage({
    db: {
      query: {
        organizationUsage: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ organizationId: "org_metered" }]),
        },
      },
      transaction: vi.fn((callback) => callback(tx)),
    } as never,
    stripe: stripe as never,
    logger: { error: vi.fn() } as never,
    reconcileSubscriptions: vi.fn(),
    syncOverageItems: createSyncOverageItems({
      stripe: stripe as never,
      config,
    }),
    reportMeterUsage: createReportMeterUsage({
      stripe: stripe as never,
      config,
    }),
  });
  const base = {
    id: "si_pro",
    price: { id: "price_pro" },
    current_period_start: 1000,
  };
  const ingest = { id: "si_ingest", price: { id: "price_ingest" } };
  const scout = { id: "si_scout", price: { id: "price_scout" } };
  const subscription = (items = [base, ingest, scout] as unknown[]) => ({
    id: "sub_metered",
    status: "active",
    metadata: { referenceId: "org_metered" },
    items: { data: items },
  });
  const usage = {
    id: "orgu_metered",
    currentPeriodStart: new Date(1000000),
    ingestOverageEnabled: true,
    scoutOverageEnabled: true,
    logsIngestedBytes: 100,
    metricsIngestedBytes: 200,
    tracesIngestedBytes: 300,
    ingestLimitBytes: 500,
    chatCreditsUsed: 1350,
    chatCreditsIncluded: 1200,
    stripeIngestBytesReported: 500,
    stripeChatCreditsReported: 1200,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    findUsage.mockResolvedValue({ ...usage });
    findSubscription.mockResolvedValue({
      stripeSubscriptionId: "sub_metered",
      stripeCustomerId: "cus_metered",
    });
    retrieve.mockResolvedValue(subscription());
    updateSubscription.mockResolvedValue(subscription());
  });
  test("reports full cumulative snapshots including the existing included allowance", async () => {
    await sync();
    expect(createMeterEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event_name: "ingest_cumulative",
        payload: { stripe_customer_id: "cus_metered", value: "600" },
      }),
    );
    expect(createMeterEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event_name: "scout_cumulative",
        payload: { stripe_customer_id: "cus_metered", value: "1350" },
      }),
    );
  });
  test("does not resend unchanged values", async () => {
    findUsage.mockResolvedValue({
      ...usage,
      stripeIngestBytesReported: 600,
      stripeChatCreditsReported: 1350,
    });
    await sync();
    expect(createMeterEvent).not.toHaveBeenCalled();
  });
  test("does not report usage when optional items are absent and disabled", async () => {
    retrieve.mockResolvedValue(subscription([base]));
    findUsage.mockResolvedValue({
      ...usage,
      ingestOverageEnabled: false,
      scoutOverageEnabled: false,
    });
    await sync();
    expect(createMeterEvent).not.toHaveBeenCalled();
    expect(updateSubscription).not.toHaveBeenCalled();
  });
  test("retains and reports final charges after disabling an incurred overage", async () => {
    findUsage.mockResolvedValue({
      ...usage,
      ingestOverageEnabled: false,
      scoutOverageEnabled: false,
    });
    await sync();
    expect(updateSubscription).not.toHaveBeenCalled();
    expect(createMeterEvent).toHaveBeenCalledTimes(2);
  });
  test("removes disabled items after renewal when counters are reset", async () => {
    findUsage.mockResolvedValue({
      ...usage,
      ingestOverageEnabled: false,
      scoutOverageEnabled: false,
      logsIngestedBytes: 0,
      metricsIngestedBytes: 0,
      tracesIngestedBytes: 0,
      chatCreditsUsed: 0,
    });
    updateSubscription.mockResolvedValue(subscription([base]));
    await sync();
    expect(updateSubscription).toHaveBeenCalledWith("sub_metered", {
      items: [
        { id: "si_ingest", deleted: true },
        { id: "si_scout", deleted: true },
      ],
      proration_behavior: "none",
    });
    expect(createMeterEvent).not.toHaveBeenCalled();
  });
  test("reports unchanged counters to a newly installed item", async () => {
    retrieve.mockResolvedValue(subscription([base]));
    findUsage.mockResolvedValue({
      ...usage,
      stripeIngestBytesReported: 600,
      stripeChatCreditsReported: 1350,
    });
    await sync();
    expect(updateSubscription).toHaveBeenCalled();
    expect(createMeterEvent).toHaveBeenCalledTimes(2);
  });
  test("does not meter a trial or canceled subscription", async () => {
    retrieve.mockResolvedValue({ ...subscription(), status: "trialing" });
    await sync();
    expect(createMeterEvent).not.toHaveBeenCalled();
  });

  test("excludes pre-opt-in usage while counting the included allowance only once", async () => {
    retrieve.mockResolvedValue(
      subscription([
        base,
        ingest,
        {
          ...scout,
          metadata: {
            orvo_usage_offset: "100",
            orvo_usage_offset_period: "1000",
          },
        },
      ]),
    );
    await sync();
    expect(createMeterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "scout_cumulative",
        payload: { stripe_customer_id: "cus_metered", value: "1250" },
      }),
    );
  });

  test("pre-opt-in offsets do not carry into another billing period", async () => {
    retrieve.mockResolvedValue(
      subscription([
        base,
        ingest,
        {
          ...scout,
          metadata: {
            orvo_usage_offset: "100",
            orvo_usage_offset_period: "999",
          },
        },
      ]),
    );
    await sync();
    expect(createMeterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "scout_cumulative",
        payload: { stripe_customer_id: "cus_metered", value: "1350" },
      }),
    );
  });
});
