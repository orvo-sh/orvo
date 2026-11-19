import { MetricsService } from "$lib/server/services/metrics";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestLogger } from "../../helpers/logger";
import {
  getClickHouseTestClient,
  startClickHouseContainer,
  stopClickHouseContainer,
} from "../../helpers/clickhouse";

let container: Awaited<ReturnType<typeof startClickHouseContainer>>;
let client: ReturnType<typeof getClickHouseTestClient>;
let service: MetricsService;

beforeAll(async () => {
  container = await startClickHouseContainer();
  client = getClickHouseTestClient(container);
  await client.command({
    query:
      "CREATE TABLE metrics_raw (app_id String, container_name String) ENGINE = Memory",
  });
  await client.insert({
    table: "metrics_raw",
    format: "JSONEachRow",
    values: [
      { app_id: "app-a", container_name: "api" },
      { app_id: "app-a", container_name: "api" },
      { app_id: "app-a", container_name: "worker's queue" },
      { app_id: "app-a", container_name: "" },
      { app_id: "app-b", container_name: "private-other-app" },
    ],
  });
  service = new MetricsService(client, createTestLogger() as never);
});

afterAll(async () => {
  if (container) await stopClickHouseContainer(container, client);
});

test("loads distinct container names for the current app and supports searching punctuation", async () => {
  const result = await service.getContainerNameSuggestions(
    {},
    { appId: "app-a" },
  );
  expect(result).toMatchObject({
    success: true,
    data: {
      values: [
        { value: "api", count: 2 },
        { value: "worker's queue", count: 1 },
      ],
    },
  });
  const search = await service.getContainerNameSuggestions(
    { query: "WORKER'S" },
    { appId: "app-a" },
  );
  expect(search).toMatchObject({
    success: true,
    data: { values: [{ value: "worker's queue", count: 1 }] },
  });
  const empty = await service.getContainerNameSuggestions(
    { query: "missing" },
    { appId: "app-a" },
  );
  expect(empty).toMatchObject({ success: true, data: { values: [] } });
});
