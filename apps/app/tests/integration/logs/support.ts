import { afterAll, beforeAll, beforeEach } from "vitest";

import { LogsService } from "$lib/server/services/logs";
import type { ClickHouse } from "@repo/clickhouse";

import {
  applyClickHouseMigrations,
  createTestLogger,
  getClickHouseTestClient,
  startClickHouseContainer,
  stopClickHouseContainer,
  truncateClickHouseTables,
  type StartedClickHouse,
} from "../../helpers";

const useLogsServiceHarness = () => {
  let container: StartedClickHouse;
  let clickhouse: ClickHouse;
  let logsService: LogsService;

  beforeAll(async () => {
    container = await startClickHouseContainer();
    clickhouse = getClickHouseTestClient(container);
    await applyClickHouseMigrations(clickhouse);
    logsService = new LogsService(clickhouse, createTestLogger() as never);
  });

  beforeEach(async () => {
    await truncateClickHouseTables(clickhouse, ["logs_raw"]);
  });

  afterAll(async () => {
    if (container) {
      await stopClickHouseContainer(container, clickhouse);
    }
  });

  return {
    get clickhouse() {
      return clickhouse;
    },
    get logsService() {
      return logsService;
    },
  };
};

const baseRange = {
  kind: "range" as const,
  start: "2026-06-28T09:00:00.000Z",
  end: "2026-06-28T11:00:00.000Z",
};

const buildRange = (start: string, end: string) => ({
  kind: "range" as const,
  start,
  end,
});

export { baseRange, buildRange, useLogsServiceHarness };
