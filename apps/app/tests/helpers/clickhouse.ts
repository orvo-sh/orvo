import { getClickHouseClient, type ClickHouse } from "@repo/clickhouse";
import { ClickHouseContainer } from "@testcontainers/clickhouse";

import {
  clickhouseMigrationsDir,
  listSqlMigrations,
  readSqlMigration,
  splitStatements,
} from "./migrations";

type StartedClickHouse = Awaited<
  ReturnType<typeof ClickHouseContainer.prototype.start>
>;

const ensureSchemaMigrationsTable = async (client: ClickHouse) => {
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version String,
        name String,
        applied_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree
      ORDER BY version
    `,
  });
};

const appliedMigrationVersions = async (client: ClickHouse) => {
  const rows = await (
    await client.query({
      query: "SELECT version FROM schema_migrations ORDER BY version",
      format: "JSONEachRow",
    })
  ).json<{ version: string }>();
  return new Set(rows.map((row) => row.version));
};

const applyClickHouseMigrations = async (client: ClickHouse) => {
  await ensureSchemaMigrationsTable(client);
  const applied = await appliedMigrationVersions(client);
  const files = await listSqlMigrations(clickhouseMigrationsDir);

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) {
      continue;
    }

    const sql = await readSqlMigration(clickhouseMigrationsDir, file);
    for (const statement of splitStatements(sql)) {
      await client.command({ query: statement });
    }

    await client.insert({
      table: "schema_migrations",
      values: [{ version, name: file }],
      format: "JSONEachRow",
    });
  }
};

const startClickHouseContainer = async (
  image = "clickhouse/clickhouse-server:latest",
) =>
  new ClickHouseContainer(image)
    .withDatabase("orvo")
    .withUsername("default")
    .withPassword("password")
    .start();

const getClickHouseTestClient = (container: StartedClickHouse): ClickHouse =>
  getClickHouseClient({ url: container.getConnectionUrl() });

const truncateClickHouseTables = async (
  client: ClickHouse,
  tables: string[] = [
    "logs_raw",
    "traces_raw",
    "metrics_raw",
    "heartbeat_checkins",
  ],
) => {
  for (const table of tables) {
    await client.command({ query: `TRUNCATE TABLE IF EXISTS ${table}` });
  }
};

const stopClickHouseContainer = async (
  container: StartedClickHouse,
  client?: ClickHouse,
) => {
  await client?.close().catch(() => {});
  await container.stop();
};

export {
  applyClickHouseMigrations,
  getClickHouseTestClient,
  startClickHouseContainer,
  stopClickHouseContainer,
  truncateClickHouseTables,
  type StartedClickHouse,
};
