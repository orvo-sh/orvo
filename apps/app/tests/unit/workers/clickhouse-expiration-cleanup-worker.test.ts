import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { describe, expect, test, vi } from "vitest";

import { ClickHouseExpirationCleanupWorker } from "../../../src/lib/server/workers/clickhouse-expiration-cleanup-worker";
import { createTestLogger } from "../../helpers/logger";

describe("ClickHouseExpirationCleanupWorker", () => {
  test("deletes expired telemetry rows from ttl-managed tables once per day", async () => {
    const command = vi.fn().mockResolvedValue({
      query_id: "query_123",
      executed: true,
    });
    const worker = new ClickHouseExpirationCleanupWorker(
      createTestLogger() as unknown as Logger,
      { command } as unknown as ClickHouse,
    );
    const run = (
      worker as unknown as {
        run: (job: { id: string; data: unknown }) => Promise<void>;
      }
    ).run;

    expect(worker.cron).toBe("0 0 * * *");

    await run.call(worker, { id: "job_123", data: {} });

    expect(command).toHaveBeenCalledTimes(3);
    expect(command).toHaveBeenNthCalledWith(1, {
      query: "ALTER TABLE logs_raw DELETE WHERE expires_at <= now64(3)",
      clickhouse_settings: {
        mutations_sync: "2",
      },
    });
    expect(command).toHaveBeenNthCalledWith(2, {
      query: "ALTER TABLE traces_raw DELETE WHERE expires_at <= now64(3)",
      clickhouse_settings: {
        mutations_sync: "2",
      },
    });
    expect(command).toHaveBeenNthCalledWith(3, {
      query: "ALTER TABLE metrics_raw DELETE WHERE expires_at <= now64(3)",
      clickhouse_settings: {
        mutations_sync: "2",
      },
    });
  });
});
