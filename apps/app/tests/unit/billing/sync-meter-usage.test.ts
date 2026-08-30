import { createSyncMeterUsage } from "$lib/server/services/billing/methods/sync-meter-usage";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createSyncMeterUsage", () => {
  const createMeterEvent = vi.fn();
  const updates: Record<string, number>[] = [];
  const rows = [
    {
      usageId: "orgu_metered",
      organizationId: "org_metered",
      periodStart: new Date("2026-08-01T00:00:00.000Z"),
      logsIngestedBytes: 100,
      tracesIngestedBytes: 200,
      metricsIngestedBytes: 300,
      chatCredits: 1_350,
      ingestBytesReported: 500,
      chatCreditsReported: 1_200,
      organizationCustomerId: "cus_metered",
      subscriptionCustomerId: null,
    },
  ];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          leftJoin: vi.fn().mockResolvedValue(rows),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value) => {
        updates.push(value);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };
  const syncMeterUsage = createSyncMeterUsage({
    db: db as never,
    logger: { error: vi.fn() } as never,
    stripe: {
      billing: { meterEvents: { create: createMeterEvent } },
    } as never,
    config: {
      ingestEventName: "orvo_ingest_bytes_cumulative",
      scoutEventName: "orvo_scout_credits_cumulative",
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    createMeterEvent.mockResolvedValue({});
  });

  test("reports cumulative ingest and weighted Scout usage", async () => {
    await syncMeterUsage();

    expect(createMeterEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event_name: "orvo_ingest_bytes_cumulative",
        payload: {
          stripe_customer_id: "cus_metered",
          value: "600",
        },
      }),
    );
    expect(createMeterEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event_name: "orvo_scout_credits_cumulative",
        payload: {
          stripe_customer_id: "cus_metered",
          value: "1350",
        },
      }),
    );
    expect(updates).toEqual([
      { stripeIngestBytesReported: 600 },
      { stripeChatCreditsReported: 1_350 },
    ]);
  });

  test("does not resend unchanged cumulative values", async () => {
    rows[0]!.ingestBytesReported = 600;
    rows[0]!.chatCreditsReported = 1_350;

    await syncMeterUsage();

    expect(createMeterEvent).not.toHaveBeenCalled();
    expect(updates).toEqual([]);

    rows[0]!.ingestBytesReported = 500;
    rows[0]!.chatCreditsReported = 1_200;
  });
});
