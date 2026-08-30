import { afterEach, describe, expect, test, vi } from "vitest";

import { createGetHeartbeatCheckInHistory } from "$lib/server/services/heartbeat/methods/get-heartbeat-check-in-history";

const createHarness = ({
  createdAt,
  expectedEverySeconds = 60,
  lastCheckInAt = null,
  bucketRows = [],
}: {
  createdAt: Date;
  expectedEverySeconds?: number;
  lastCheckInAt?: Date | null;
  bucketRows?: Array<{ bucket_start_ms: number | string; total: number }>;
}) => {
  const queries: string[] = [];
  const service = createGetHeartbeatCheckInHistory({
    db: {
      query: {
        heartbeatMonitor: {
          findFirst: vi.fn().mockResolvedValue({
            id: "hbmt_test",
            appId: "app_test",
            expectedEverySeconds,
            graceSeconds: 30,
            lastCheckInAt,
            pausedAt: null,
            createdAt,
          }),
        },
      },
    } as never,
    clickhouse: {
      query: vi.fn().mockImplementation(({ query }: { query: string }) => {
        queries.push(query);
        return Promise.resolve({
          json: () =>
            Promise.resolve(query.includes("GROUP BY") ? bucketRows : []),
        });
      }),
    } as never,
    logger: { error: vi.fn() } as never,
  });

  return { queries, service };
};

describe("get heartbeat check-in history", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("does not mark time before the first heartbeat as missed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const { service } = createHarness({
      createdAt: new Date("2026-08-24T11:59:00.000Z"),
    });

    const result = await service("hbmt_test", { appId: "app_test" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.history.buckets.length).toBeGreaterThan(0);
    expect(
      result.data.history.buckets.every(
        (bucket) => bucket.status === "pending",
      ),
    ).toBe(true);
    expect(result.data.history.stats.missedBuckets24h).toBe(0);
  });

  test("shows a sixty-day window for a daily heartbeat", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const { queries, service } = createHarness({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expectedEverySeconds: 24 * 60 * 60,
      lastCheckInAt: new Date("2026-08-24T11:00:00.000Z"),
    });

    const result = await service("hbmt_test", { appId: "app_test" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.history.windowSeconds).toBe(60 * 24 * 60 * 60);
    expect(result.data.history.buckets).toHaveLength(61);
    expect(queries.some((query) => query.includes("LIMIT 60"))).toBe(true);
    expect(
      queries.some(
        (query) =>
          query.includes("toUnixTimestamp(") &&
          !query.includes("toUnixTimestamp64Milli"),
      ),
    ).toBe(true);
  });

  test("keeps buckets before the first received heartbeat neutral", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const checkedInAt = new Date("2026-08-24T11:59:00.000Z");
    const bucketSizeMs = 24 * 60 * 1000;
    const receivedBucketMs =
      Math.floor(checkedInAt.getTime() / bucketSizeMs) * bucketSizeMs;
    const { service } = createHarness({
      createdAt: new Date("2026-08-24T10:00:00.000Z"),
      lastCheckInAt: checkedInAt,
      bucketRows: [{ bucket_start_ms: String(receivedBucketMs), total: 1 }],
    });

    const result = await service("hbmt_test", { appId: "app_test" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(
      result.data.history.buckets.some((bucket) => bucket.status === "healthy"),
    ).toBe(true);
    expect(
      result.data.history.buckets.every((bucket) => bucket.status !== "missed"),
    ).toBe(true);
  });
});
