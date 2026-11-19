import { afterEach, describe, expect, test, vi } from "vitest";

import { createGetHeartbeatCheckInHistory } from "$lib/server/services/heartbeat/methods/get-heartbeat-check-in-history";

const createHarness = ({
  createdAt,
  expectedEverySeconds = 60,
  lastCheckInAt = null,
  bucketRows = [],
  firstCheckInAt = lastCheckInAt,
  graceSeconds = 30,
}: {
  createdAt: Date;
  firstCheckInAt?: Date | null;
  graceSeconds?: number;
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
            graceSeconds,
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
            Promise.resolve(
              query.includes("GROUP BY")
                ? bucketRows
                : query.includes("ASC LIMIT 1") && firstCheckInAt
                  ? [{ checked_in_at: firstCheckInAt.toISOString() }]
                  : [],
            ),
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

  test("shows at most thirty configured intervals for a daily heartbeat", async () => {
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

    expect(result.data.history.windowSeconds).toBe(30 * 24 * 60 * 60);
    expect(result.data.history.buckets).toHaveLength(30);
    expect(queries.some((query) => query.includes("LIMIT 60"))).toBe(true);
    expect(
      queries.some((query) =>
        query.includes("intDiv(toUnixTimestamp64Milli(checked_in_at)"),
      ),
    ).toBe(true);
  });

  test("keeps buckets before the first received heartbeat neutral", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const checkedInAt = new Date("2026-08-24T11:59:00.000Z");
    const bucketSizeMs = 60 * 1000;
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
  test("keeps the current interval pending and waits for grace before marking a miss", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:02:00.000Z"));
    const { service } = createHarness({
      createdAt: new Date("2026-08-24T11:00:00.000Z"),
      expectedEverySeconds: 300,
      graceSeconds: 180,
      firstCheckInAt: new Date("2026-08-24T11:00:01.000Z"),
    });
    const result = await service("hbmt_test", { appId: "app_test" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const buckets = result.data.history.buckets;
    expect(buckets).toHaveLength(13);
    expect(buckets.at(-1)?.status).toBe("pending");
    expect(buckets.at(-2)?.status).toBe("grace");
    expect(buckets.at(-3)?.status).toBe("missed");

    vi.setSystemTime(new Date("2026-08-24T12:03:00.000Z"));
    const expired = await service("hbmt_test", { appId: "app_test" });
    expect(expired.success).toBe(true);
    if (!expired.success) return;
    expect(expired.data.history.buckets.at(-2)?.status).toBe("missed");
  });

  test("anchors intervals to creation and groups a burst into one received segment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const anchor = new Date("2026-08-24T11:02:17.123Z");
    const { service, queries } = createHarness({
      createdAt: anchor,
      expectedEverySeconds: 300,
      firstCheckInAt: anchor,
      bucketRows: [
        { bucket_start_ms: anchor.getTime() + 10 * 300000, total: 20 },
      ],
    });
    const result = await service("hbmt_test", { appId: "app_test" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const { buckets, bucketSizeSeconds } = result.data.history;
    expect(bucketSizeSeconds).toBe(300);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].startAt).toEqual(anchor);
    expect(
      buckets.filter((bucket) => bucket.status === "healthy"),
    ).toHaveLength(1);
    expect(buckets.at(-2)?.count).toBe(20);
    expect(buckets.at(-1)?.status).toBe("pending");
    expect(queries[0]).toContain(`${anchor.getTime()} + intDiv`);
  });
});
