import { describe, expect, test } from "vitest";

import { buildLog, insertLogs } from "../../helpers";
import { baseRange, useLogsServiceHarness } from "./support";

describe("LogsService.getLogs", () => {
  const harness = useLogsServiceHarness();

  test("returns only logs for the requested app", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_a_1",
        app_id: "app_a",
        timestamp: "2026-06-28T10:00:00.000Z",
        body: "app a message",
      }),
      buildLog({
        id: "log_b_1",
        app_id: "app_b",
        timestamp: "2026-06-28T10:01:00.000Z",
        body: "app b message",
      }),
    ]);

    const result = await harness.logsService.getLogs(
      { time: baseRange, limit: 10 },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.logs).toHaveLength(1);
    expect(result.data.logs[0]?.id).toBe("log_a_1");
    expect(result.data.nextCursor).toBeNull();
  });

  test("sorts logs by timestamp desc and id desc", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_a",
        app_id: "app_a",
        timestamp: "2026-06-28T10:00:00.000Z",
      }),
      buildLog({
        id: "log_c",
        app_id: "app_a",
        timestamp: "2026-06-28T10:05:00.000Z",
      }),
      buildLog({
        id: "log_b",
        app_id: "app_a",
        timestamp: "2026-06-28T10:05:00.000Z",
      }),
    ]);

    const result = await harness.logsService.getLogs(
      { time: baseRange, limit: 10 },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.logs.map((log) => log.id)).toEqual([
      "log_c",
      "log_b",
      "log_a",
    ]);
  });

  test("returns a cursor and paginates without duplicates", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_3",
        app_id: "app_a",
        timestamp: "2026-06-28T10:03:00.000Z",
      }),
      buildLog({
        id: "log_2",
        app_id: "app_a",
        timestamp: "2026-06-28T10:02:00.000Z",
      }),
      buildLog({
        id: "log_1",
        app_id: "app_a",
        timestamp: "2026-06-28T10:01:00.000Z",
      }),
    ]);

    const firstPage = await harness.logsService.getLogs(
      { time: baseRange, limit: 2 },
      { appId: "app_a" },
    );

    expect(firstPage).toMatchObject({ success: true });
    if (!firstPage.success) {
      return;
    }

    expect(firstPage.data.logs.map((log) => log.id)).toEqual([
      "log_3",
      "log_2",
    ]);
    expect(firstPage.data.nextCursor).toBe("log_2");

    const secondPage = await harness.logsService.getLogs(
      {
        time: baseRange,
        limit: 2,
        cursor: firstPage.data.nextCursor ?? undefined,
      },
      { appId: "app_a" },
    );

    expect(secondPage).toMatchObject({ success: true });
    if (!secondPage.success) {
      return;
    }

    expect(secondPage.data.logs.map((log) => log.id)).toEqual(["log_1"]);
    expect(secondPage.data.nextCursor).toBeNull();
  });

  test("handles pagination tie-breaks when timestamps are identical", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_c",
        app_id: "app_a",
        timestamp: "2026-06-28T10:00:00.000Z",
      }),
      buildLog({
        id: "log_b",
        app_id: "app_a",
        timestamp: "2026-06-28T10:00:00.000Z",
      }),
      buildLog({
        id: "log_a",
        app_id: "app_a",
        timestamp: "2026-06-28T10:00:00.000Z",
      }),
    ]);

    const firstPage = await harness.logsService.getLogs(
      { time: baseRange, limit: 2 },
      { appId: "app_a" },
    );

    expect(firstPage).toMatchObject({ success: true });
    if (!firstPage.success) {
      return;
    }

    expect(firstPage.data.logs.map((log) => log.id)).toEqual([
      "log_c",
      "log_b",
    ]);

    const secondPage = await harness.logsService.getLogs(
      {
        time: baseRange,
        limit: 2,
        cursor: firstPage.data.nextCursor ?? undefined,
      },
      { appId: "app_a" },
    );

    expect(secondPage).toMatchObject({ success: true });
    if (!secondPage.success) {
      return;
    }

    expect(secondPage.data.logs.map((log) => log.id)).toEqual(["log_a"]);
  });

  test("includes rows exactly on the time range boundaries", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_start",
        app_id: "app_a",
        timestamp: "2026-06-28T09:00:00.000Z",
      }),
      buildLog({
        id: "log_end",
        app_id: "app_a",
        timestamp: "2026-06-28T11:00:00.000Z",
      }),
      buildLog({
        id: "log_outside",
        app_id: "app_a",
        timestamp: "2026-06-28T11:00:00.001Z",
      }),
    ]);

    const result = await harness.logsService.getLogs(
      { time: baseRange, limit: 10 },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.logs.map((log) => log.id)).toEqual([
      "log_end",
      "log_start",
    ]);
  });

  test("applies static filters for equals, contains, and not in", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_api_error",
        app_id: "app_a",
        timestamp: "2026-06-28T10:10:00.000Z",
        service_name: "api",
        severity_text: "error",
        body: "database connection failed",
      }),
      buildLog({
        id: "log_api_info",
        app_id: "app_a",
        timestamp: "2026-06-28T10:20:00.000Z",
        service_name: "api",
        severity_text: "info",
        body: "request completed",
      }),
      buildLog({
        id: "log_worker",
        app_id: "app_a",
        timestamp: "2026-06-28T10:30:00.000Z",
        service_name: "worker",
        severity_text: "warn",
        body: "retrying job",
      }),
    ]);

    const result = await harness.logsService.getLogs(
      {
        time: baseRange,
        limit: 10,
        activeFilters: [
          {
            attribute: "service",
            operator: "eq",
            value: "api",
          },
          {
            attribute: "message",
            operator: "contains",
            value: "request",
          },
          {
            attribute: "status",
            operator: "not_in",
            value: "error|warn",
          },
        ],
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.logs.map((log) => log.id)).toEqual(["log_api_info"]);
  });

  test("applies dynamic resource and nested log attribute filters", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_match",
        app_id: "app_a",
        timestamp: "2026-06-28T10:10:00.000Z",
        resource_attributes: {
          "host.name": "web-01",
        },
        log_attributes: {
          payload: '{"user":{"id":"123","role":"admin"}}',
        },
      }),
      buildLog({
        id: "log_other",
        app_id: "app_a",
        timestamp: "2026-06-28T10:20:00.000Z",
        resource_attributes: {
          "host.name": "worker-01",
        },
        log_attributes: {
          payload: '{"user":{"id":"999","role":"member"}}',
        },
      }),
    ]);

    const result = await harness.logsService.getLogs(
      {
        time: baseRange,
        limit: 10,
        activeFilters: [
          {
            attribute: "resource.host.name",
            operator: "contains",
            value: "web",
          },
          {
            attribute: "attribute.payload.user.id",
            operator: "eq",
            value: "123",
          },
        ],
      },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.logs.map((log) => log.id)).toEqual(["log_match"]);
  });

  test("ignores unknown filters while applying valid ones", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_api",
        app_id: "app_a",
        timestamp: "2026-06-28T10:10:00.000Z",
        service_name: "api",
      }),
      buildLog({
        id: "log_worker",
        app_id: "app_a",
        timestamp: "2026-06-28T10:20:00.000Z",
        service_name: "worker",
      }),
    ]);

    const result = await harness.logsService.getLogs(
      {
        time: baseRange,
        limit: 10,
        activeFilters: [
          {
            attribute: "unknown.attribute",
            operator: "eq",
            value: "ignored",
          },
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

    expect(result.data.logs.map((log) => log.id)).toEqual(["log_api"]);
  });

  test("rejects invalid input", async () => {
    const result = await harness.logsService.getLogs(
      {
        time: baseRange,
        limit: 0,
      },
      { appId: "app_a" },
    );

    expect(result).toEqual({
      success: false,
      error: expect.any(String),
    });
  });
});
