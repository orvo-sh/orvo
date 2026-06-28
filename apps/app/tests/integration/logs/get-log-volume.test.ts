import { describe, expect, test } from "vitest";

import { buildLog, insertLogs } from "../../helpers";
import { baseRange, useLogsServiceHarness } from "./support";

describe("LogsService log volume queries", () => {
  const harness = useLogsServiceHarness();

  test("returns zero-filled buckets and severity totals", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        id: "log_error",
        timestamp: "2026-06-28T09:10:00.000Z",
        severity_text: "error",
      }),
      buildLog({
        app_id: "app_a",
        id: "log_warn",
        timestamp: "2026-06-28T09:20:00.000Z",
        severity_text: "warning",
      }),
      buildLog({
        app_id: "app_a",
        id: "log_debug",
        timestamp: "2026-06-28T10:20:00.000Z",
        severity_text: "debug",
      }),
      buildLog({
        app_id: "app_a",
        id: "log_info",
        timestamp: "2026-06-28T10:40:00.000Z",
        severity_text: "info",
      }),
    ]);

    const result = await harness.logsService.getLogVolume(
      {
        time: baseRange,
        bucketCount: 10,
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.buckets).toHaveLength(10);
    expect(result.data.buckets[0]).toMatchObject({
      error: 1,
      total: 1,
    });
    expect(result.data.buckets[1]).toMatchObject({
      warn: 1,
      total: 1,
    });
    expect(result.data.buckets[6]).toMatchObject({
      debug: 1,
      total: 1,
    });
    expect(result.data.buckets[8]).toMatchObject({
      info: 1,
      total: 1,
    });
  });

  test("applies filters to log volume queries", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        service_name: "api",
        timestamp: "2026-06-28T09:10:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        service_name: "worker",
        timestamp: "2026-06-28T09:20:00.000Z",
      }),
    ]);

    const result = await harness.logsService.getLogVolume(
      {
        time: baseRange,
        bucketCount: 10,
        activeFilters: [
          {
            attribute: "service",
            operator: "eq",
            value: "api",
          },
        ],
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(1);
  });

  test("groups service volumes by service name", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        id: "api_error",
        service_name: "api",
        timestamp: "2026-06-28T09:10:00.000Z",
        severity_text: "error",
      }),
      buildLog({
        app_id: "app_a",
        id: "api_info",
        service_name: "api",
        timestamp: "2026-06-28T10:10:00.000Z",
        severity_text: "info",
      }),
      buildLog({
        app_id: "app_a",
        id: "worker_error",
        service_name: "worker",
        timestamp: "2026-06-28T10:10:00.000Z",
        severity_text: "fatal",
      }),
    ]);

    const result = await harness.logsService.getLogServiceVolume(
      {
        time: baseRange,
        bucketCount: 5,
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.services).toHaveLength(2);
    expect(result.data.services).toEqual([
      {
        name: "api",
        buckets: [
          {
            startAtUtc: "2026-06-28T09:00:00.000Z",
            total: 1,
            errors: 1,
          },
          {
            startAtUtc: "2026-06-28T09:24:00.000Z",
            total: 0,
            errors: 0,
          },
          {
            startAtUtc: "2026-06-28T09:48:00.000Z",
            total: 1,
            errors: 0,
          },
          {
            startAtUtc: "2026-06-28T10:12:00.000Z",
            total: 0,
            errors: 0,
          },
          {
            startAtUtc: "2026-06-28T10:36:00.000Z",
            total: 0,
            errors: 0,
          },
        ],
      },
      {
        name: "worker",
        buckets: [
          {
            startAtUtc: "2026-06-28T09:00:00.000Z",
            total: 0,
            errors: 0,
          },
          {
            startAtUtc: "2026-06-28T09:24:00.000Z",
            total: 0,
            errors: 0,
          },
          {
            startAtUtc: "2026-06-28T09:48:00.000Z",
            total: 1,
            errors: 1,
          },
          {
            startAtUtc: "2026-06-28T10:12:00.000Z",
            total: 0,
            errors: 0,
          },
          {
            startAtUtc: "2026-06-28T10:36:00.000Z",
            total: 0,
            errors: 0,
          },
        ],
      },
    ]);
  });
});
