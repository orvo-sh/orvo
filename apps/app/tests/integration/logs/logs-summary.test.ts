import { describe, expect, test } from "vitest";

import { buildLog, insertLogs } from "../../helpers";
import { baseRange, useLogsServiceHarness } from "./support";

describe("LogsService summary methods", () => {
  const harness = useLogsServiceHarness();

  test("counts total logs in range", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-28T09:10:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-28T09:20:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-29T09:20:00.000Z",
      }),
    ]);

    const result = await harness.logsService.getTotalLogs(
      { time: baseRange },
      { appId: "app_a" },
    );

    expect(result).toEqual({
      success: true,
      data: { total: 2 },
    });
  });

  test("computes logs trend against the previous window", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-28T09:10:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-28T09:20:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-28T09:30:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        timestamp: "2026-06-28T07:10:00.000Z",
      }),
    ]);

    const result = await harness.logsService.getLogsTrend(
      { time: baseRange },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.total).toBe(3);
    expect(result.data.trend).toBe(200);
  });

  test("returns per-service summary rows", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        app_id: "app_a",
        service_name: "api",
        severity_text: "error",
        timestamp: "2026-06-28T10:05:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        service_name: "api",
        severity_text: "info",
        timestamp: "2026-06-28T10:15:00.000Z",
      }),
      buildLog({
        app_id: "app_a",
        service_name: "worker",
        severity_text: "warn",
        timestamp: "2026-06-28T10:20:00.000Z",
      }),
    ]);

    const result = await harness.logsService.getLogServiceSummary(
      { time: baseRange },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.services).toEqual([
      {
        name: "api",
        total: 2,
        errors: 1,
        lastSeen: "2026-06-28T10:15:00.000Z",
      },
      {
        name: "worker",
        total: 1,
        errors: 0,
        lastSeen: "2026-06-28T10:20:00.000Z",
      },
    ]);
  });
});
