import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

const ttlManagedTables = ["logs_raw", "traces_raw", "metrics_raw"] as const;

class ClickHouseExpirationCleanupWorker extends BaseWorker {
  name = "clickhouse-expiration-cleanup";
  cron = "0 0 * * *";

  constructor(
    logger: Logger,
    private clickhouse: ClickHouse,
  ) {
    super(logger, "ClickHouseExpirationCleanupWorker");
  }

  protected async run() {
    for (const table of ttlManagedTables) {
      await this.clickhouse.command({
        // ClickHouse TTL deletes are merge-driven; run a daily mutation so expiry is enforced predictably.
        query: `ALTER TABLE ${table} DELETE WHERE expires_at <= now64(3)`,
        clickhouse_settings: {
          mutations_sync: "2",
        },
      });
    }
  }
}

export { ClickHouseExpirationCleanupWorker };
