import { afterAll, beforeAll, expect, test } from "vitest";
import { createGetHosts } from "$lib/server/services/agent/methods/get-hosts";
import { createGetHost } from "$lib/server/services/agent/methods/get-host";
import { createTestLogger } from "../../helpers/logger";
import {
  applyClickHouseMigrations,
  getClickHouseTestClient,
  startClickHouseContainer,
  stopClickHouseContainer,
} from "../../helpers/clickhouse";
import {
  clickhouseMigrationsDir,
  readSqlMigration,
  splitStatements,
} from "../../helpers/migrations";

let container: Awaited<ReturnType<typeof startClickHouseContainer>>;
let client: ReturnType<typeof getClickHouseTestClient>;
const now = Date.now();
const installation = {
  id: "installation-1",
  appId: "app-1",
  hostId: "host-1",
  hostName: "original-host",
  agentVersion: "0.0.1",
  architecture: "amd64",
  operatingSystem: "linux",
  createdAt: new Date(now),
};
const db = {
  select: () => ({
    from: () => ({
      where: () =>
        Object.assign([installation], { limit: async () => [installation] }),
    }),
  }),
};
const metric = (
  id: string,
  hostName: string,
  time: number,
  appId = "app-1",
) => ({
  id,
  app_id: appId,
  ingestion_key_id: "key-1",
  entity_kind: "host",
  host_id: "host-1",
  host_name: hostName,
  host_arch: "amd64",
  os_type: "linux",
  deployment_environment: "production",
  metric_name: "system.cpu.utilization",
  metric_type: "gauge",
  metric_unit: "1",
  attributes: { state: "idle" },
  resource_attributes: { "orvo.agent.version": "0.0.1" },
  value_double: 0.75,
  value_int: null,
  time: new Date(time).toISOString().replace("T", " ").replace("Z", ""),
  received_at: new Date(now).toISOString().replace("T", " ").replace("Z", ""),
  expires_at: new Date(now + 86400000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", ""),
});

beforeAll(async () => {
  // Match the server version that rejected the aggregate-state TTL expression.
  container = await startClickHouseContainer(
    "clickhouse/clickhouse-server:25.3",
  );
  client = getClickHouseTestClient(container);
  const initial = await readSqlMigration(
    clickhouseMigrationsDir,
    "0000_initial_schema.sql",
  );
  for (const query of splitStatements(initial)) await client.command({ query });
  await client.insert({
    table: "metrics_raw",
    format: "JSONEachRow",
    values: [
      metric("before-migration", "backfilled-host", now - 60000),
      metric("other-app", "private-host", now, "app-2"),
    ],
  });
  await applyClickHouseMigrations(client);
});

afterAll(async () => {
  if (container) await stopClickHouseContainer(container, client);
});

test("host migration works on ClickHouse 25.3 and backfills existing host metrics", async () => {
  const getHosts = createGetHosts({
    db: db as never,
    clickhouse: client,
    logger: createTestLogger() as never,
  });
  const result = await getHosts({ appId: "app-1" });
  expect(result).toMatchObject({
    success: true,
    data: {
      hosts: [
        { hostName: "backfilled-host", reporting: true, cpuUtilization: 25 },
      ],
    },
  });
  expect(JSON.stringify(result)).not.toContain("private-host");
});

test("new host reports update the materialized state used by the list and detail pages", async () => {
  await client.insert({
    table: "metrics_raw",
    format: "JSONEachRow",
    values: [metric("after-migration", "current-host", now - 1000)],
  });
  const dependencies = {
    db: db as never,
    clickhouse: client,
    logger: createTestLogger() as never,
  };
  const result = await createGetHosts(dependencies)({ appId: "app-1" });
  expect(result).toMatchObject({
    success: true,
    data: {
      hosts: [
        {
          hostName: "current-host",
          reporting: true,
          cpuUtilization: 25,
          lastSeen: new Date(now - 1000).toISOString(),
        },
      ],
    },
  });
  const detail = await createGetHost(dependencies)(
    { id: installation.id, time: "1h" },
    { appId: "app-1" },
  );
  expect(detail).toMatchObject({
    success: true,
    data: {
      host: { hostName: "current-host", reporting: true, cpuUtilization: 25 },
    },
  });
});
