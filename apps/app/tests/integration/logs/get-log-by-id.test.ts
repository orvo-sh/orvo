import { describe, expect, test } from "vitest";

import { buildLog, insertLogs } from "../../helpers";
import { useLogsServiceHarness } from "./support";

describe("LogsService.getLogById", () => {
  const harness = useLogsServiceHarness();

  test("returns the requested log for the current app", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "log_a",
        app_id: "app_a",
        timestamp: "2026-06-28T10:00:00.000Z",
      }),
    ]);

    const result = await harness.logsService.getLogById(
      { id: "log_a" },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.log?.id).toBe("log_a");
    expect(result.data.log?.timestamp).toBe("2026-06-28T10:00:00.000Z");
  });

  test("returns null when the log does not exist", async () => {
    const result = await harness.logsService.getLogById(
      { id: "missing" },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.log).toBeNull();
  });

  test("does not leak logs from another app", async () => {
    await insertLogs(harness.clickhouse, [
      buildLog({
        id: "shared_id",
        app_id: "app_b",
      }),
    ]);

    const result = await harness.logsService.getLogById(
      { id: "shared_id" },
      { appId: "app_a" },
    );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      return;
    }

    expect(result.data.log).toBeNull();
  });

  test("rejects invalid ids", async () => {
    const result = await harness.logsService.getLogById(
      { id: "" },
      { appId: "app_a" },
    );

    expect(result).toEqual({
      success: false,
      error: expect.any(String),
    });
  });
});
