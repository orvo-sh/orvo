import { afterAll, beforeAll, expect, test } from "vitest";
import { getDb, getDbClient } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import { getClickHouseClient } from "@repo/clickhouse";
import { createGetHeartbeatCheckInHistory } from "$lib/server/services/heartbeat/methods/get-heartbeat-check-in-history";
import { createApp, createOrganization } from "../../helpers/app-fixtures";
import { createTestLogger } from "../../helpers/logger";
import {
  applyPostgresMigrations,
  startPostgresContainer,
  stopPostgresContainer,
} from "../../helpers/postgres";
import {
  applyClickHouseMigrations,
  startClickHouseContainer,
  getClickHouseTestClient,
  stopClickHouseContainer,
} from "../../helpers/clickhouse";

let postgres: Awaited<ReturnType<typeof startPostgresContainer>>;
let clickhouse: Awaited<ReturnType<typeof startClickHouseContainer>>;
let db: ReturnType<typeof getDb>;
let client: ReturnType<typeof getClickHouseTestClient>;
let appId: string;
const checkedInAt = new Date(Date.now() - 3000);

beforeAll(async () => {
  [postgres, clickhouse] = await Promise.all([
    startPostgresContainer(),
    startClickHouseContainer(),
  ]);
  db = getDb(postgres.getConnectionUri());
  client = getClickHouseTestClient(clickhouse);
  await Promise.all([
    applyPostgresMigrations(db),
    applyClickHouseMigrations(client),
  ]);
  const org = await createOrganization(db);
  const app = await createApp(db, { organizationId: org.id });
  appId = app.id;
  await db.insert(heartbeatMonitor).values({
    id: "timezone-monitor",
    appId,
    name: "Timezone check",
    token: "timezone-secret",
    expectedEverySeconds: 300,
    graceSeconds: 60,
    lastCheckInAt: checkedInAt,
    createdAt: new Date(checkedInAt.getTime() - 60000),
  });
  await client.insert({
    table: "heartbeat_checkins",
    format: "JSONEachRow",
    values: [
      {
        id: "timezone-check-in",
        app_id: appId,
        heartbeat_monitor_id: "timezone-monitor",
        checked_in_at: checkedInAt
          .toISOString()
          .replace("T", " ")
          .replace("Z", ""),
      },
    ],
  });
});
afterAll(async () => {
  if (postgres) {
    await getDbClient(postgres.getConnectionUri()).end();
    await stopPostgresContainer(postgres);
  }
  if (clickhouse) await stopClickHouseContainer(clickhouse, client);
});

test("ClickHouse emits unambiguous UTC timestamps even for explicitly zoned columns", async () => {
  const result = await client.query({
    format: "JSONEachRow",
    query:
      "SELECT toDateTime64('2026-11-19 18:00:00.123', 3, 'Africa/Harare') AS timestamp",
  });
  const [row] = await result.json<{ timestamp: string }>();
  expect(row.timestamp).toBe("2026-11-19T16:00:00.123Z");
});

test("a fresh check-in has the same timestamp in history and monitor state on a UTC+2 server", async () => {
  const timezone = process.env.TZ;
  const rawClient = getClickHouseClient({ url: clickhouse.getConnectionUrl() });
  const simpleClient = new Proxy(rawClient, {
    get(target, property, receiver) {
      if (property === "query")
        return (params: Parameters<typeof rawClient.query>[0]) =>
          target.query({
            ...params,
            clickhouse_settings: {
              ...params.clickhouse_settings,
              date_time_output_format: "simple",
            },
          });
      return Reflect.get(target, property, receiver);
    },
  });
  try {
    process.env.TZ = "Africa/Harare";
    for (const source of [client, simpleClient]) {
      const getHistory = createGetHeartbeatCheckInHistory({
        db,
        clickhouse: source,
        logger: createTestLogger() as never,
      });
      const result = await getHistory("timezone-monitor", { appId });
      expect(result.success).toBe(true);
      if (!result.success) throw new Error(result.error);
      expect(
        result.data.history.recentCheckIns[0].checkedInAt.toISOString(),
      ).toBe(checkedInAt.toISOString());
      expect(
        result.data.history.buckets.some((bucket) => bucket.count === 1),
      ).toBe(true);
      const monitor = await db.query.heartbeatMonitor.findFirst({
        where: (monitor, { eq }) => eq(monitor.id, "timezone-monitor"),
      });
      expect(monitor!.lastCheckInAt!.getTime()).toBe(
        result.data.history.recentCheckIns[0].checkedInAt.getTime(),
      );
    }
  } finally {
    await simpleClient.close();
    if (timezone === undefined) delete process.env.TZ;
    else process.env.TZ = timezone;
  }
});

test("history groups check-in bursts into the latest thirty configured intervals", async () => {
  const intervalMs = 300000;
  const anchor = new Date(Date.now() - 40 * intervalMs - 12345);
  const times = [1000, 2000, 3000].map(
    (offset) => new Date(anchor.getTime() + 38 * intervalMs + offset),
  );
  times.push(new Date(anchor.getTime() + 39 * intervalMs + 1000));
  await db.insert(heartbeatMonitor).values({
    id: "interval-monitor",
    appId,
    name: "Interval check",
    token: "interval-secret",
    expectedEverySeconds: 300,
    graceSeconds: 60,
    createdAt: anchor,
    lastCheckInAt: times.at(-1),
  });
  await client.insert({
    table: "heartbeat_checkins",
    format: "JSONEachRow",
    values: times.map((time, index) => ({
      id: `interval-check-in-${index}`,
      app_id: appId,
      heartbeat_monitor_id: "interval-monitor",
      checked_in_at: time.toISOString().replace("T", " ").replace("Z", ""),
    })),
  });
  const service = createGetHeartbeatCheckInHistory({
    db,
    clickhouse: client,
    logger: createTestLogger() as never,
  });
  const result = await service("interval-monitor", { appId });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  const { buckets } = result.data.history;
  expect(buckets).toHaveLength(30);
  expect(buckets[0].startAt.getTime()).toBe(anchor.getTime() + 11 * intervalMs);
  expect(buckets.at(-3)?.count).toBe(3);
  expect(buckets.at(-2)?.count).toBe(1);
  expect(buckets.at(-1)?.status).toBe("pending");
  expect(buckets.filter((bucket) => bucket.status === "healthy")).toHaveLength(
    2,
  );
  expect(buckets.filter((bucket) => bucket.status === "missed")).toHaveLength(
    0,
  );
});
