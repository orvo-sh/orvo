import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ClickHouseContainer } from "@testcontainers/clickhouse";
import type { FullConfig } from "@playwright/test";
import { getDb } from "@repo/db";
import { MinioContainer } from "@testcontainers/minio";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getClickHouseClient } from "@repo/clickhouse";
import { migrate as postgresMigrator } from "drizzle-orm/postgres-js/migrator";
import { readdir, readFile } from "node:fs/promises";

const TEST_APP_PORT = 42173;
const TEST_APP_ORIGIN = `http://127.0.0.1:${TEST_APP_PORT}`;

type GlobalTestContainers = {
  postgres: StartedPostgreSqlContainer;
  clickhouse: Awaited<ReturnType<typeof ClickHouseContainer.prototype.start>>;
  minio: Awaited<ReturnType<typeof MinioContainer.prototype.start>>;
  appServer: ChildProcess;
};

const globalSetup = async (_config: FullConfig) => {
  const postgresContainer = await setupPostgresContainer();
  const clickhouseContainer = await setupClickHouseContainer();
  const minioContainer = await setupMinIOContainer();

  process.env.NODE_ENV = "test";
  process.env.MODE = "test";
  process.env.POSTGRES_URL = postgresContainer.getConnectionUri();
  process.env.CLICKHOUSE_URL = clickhouseContainer.getConnectionUrl();
  process.env.ORIGIN = TEST_APP_ORIGIN;
  process.env.ENCRYPTION_SECRET = crypto.randomUUID();

  process.env.S3_ACCESS_KEY_ID = minioContainer.getUsername();
  process.env.S3_SECRET_ACCESS_KEY = minioContainer.getPassword();
  process.env.S3_ENDPOINT = minioContainer.getConnectionUrl();
  process.env.S3_REGION = "us-east-1";
  process.env.S3_BUCKET_NAME = "orvo-test";
  process.env.CDN_BASE_URL = minioContainer.getConnectionUrl();

  const appServer = await startAppServer();

  (
    global as typeof globalThis & { __TESTCONTAINER__?: GlobalTestContainers }
  ).__TESTCONTAINER__ = {
    postgres: postgresContainer,
    clickhouse: clickhouseContainer,
    minio: minioContainer,
    appServer,
  };
};

const startAppServer = async (): Promise<ChildProcess> => {
  console.log(`Starting app test server on ${TEST_APP_ORIGIN}.`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const appRoot = resolve(__dirname, "..");

  const server = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(TEST_APP_PORT),
      "--strictPort",
    ],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        MODE: "test",
      },
      stdio: "pipe",
    },
  );

  server.stdout?.on("data", (chunk) => {
    process.stdout.write(`[app-server] ${chunk}`);
  });

  server.stderr?.on("data", (chunk) => {
    process.stderr.write(`[app-server] ${chunk}`);
  });

  await waitForServer(`${TEST_APP_ORIGIN}/sign-up`, server);

  return server;
};

const waitForServer = async (url: string, server: ChildProcess) => {
  const timeoutMs = 30_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`App server exited early with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`App server did not become ready within ${timeoutMs}ms`);
};

const setupPostgresContainer = async () => {
  console.log("Setting up PostgreSQL(pgvector/pgvector:pg17) container.");

  const container = await new PostgreSqlContainer("pgvector/pgvector:pg17")
    .withDatabase("orvo")
    .withUsername("postgres")
    .withPassword("password")
    .start();

  const db = getDb(container.getConnectionUri());
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  await postgresMigrator(db, {
    migrationsFolder: resolve(__dirname, "../../../packages/db/drizzle"),
  });

  return container;
};

const setupClickHouseContainer = async () => {
  console.log("Setting up ClickHouse container.");

  const container = await new ClickHouseContainer(
    "clickhouse/clickhouse-server:latest",
  )
    .withDatabase("orvo")
    .withUsername("default")
    .withPassword("password")
    .start();

  const client = getClickHouseClient({ url: container.getConnectionUrl() });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const migrationsDir = resolve(
    __dirname,
    "../../../packages/clickhouse/migrations",
  );

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

  const appliedRows = await (
    await client.query({
      query: "SELECT version FROM schema_migrations ORDER BY version",
      format: "JSONEachRow",
    })
  ).json<{ version: string }>();

  const appliedVersions = new Set(
    appliedRows.map((row: { version: string }) => row.version),
  );
  const migrations = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    const version = migration.replace(/\.sql$/, "");
    if (appliedVersions.has(version)) {
      continue;
    }

    const sql = await readFile(resolve(migrationsDir, migration), "utf8");
    const statements = sql
      .split(/^-- statement-breakpoint\s*$/m)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.command({ query: statement });
    }

    await client.insert({
      table: "schema_migrations",
      values: [{ version, name: migration }],
      format: "JSONEachRow",
    });

    console.log(`Applied ClickHouse migration ${migration}`);
  }

  await client.close();

  return container;
};

const setupMinIOContainer = async () => {
  console.log("Setting up MinIO container.");

  const container = await new MinioContainer("minio/minio:latest")
    .withUsername("minioadmin")
    .withPassword("minioadmin")
    .start();

  const endpoint = container.getConnectionUrl();
  const { S3Client, CreateBucketCommand } = await import("@aws-sdk/client-s3");
  const s3Client = new S3Client({
    region: "us-east-1",
    endpoint,
    credentials: {
      accessKeyId: container.getUsername(),
      secretAccessKey: container.getPassword(),
    },
    forcePathStyle: true,
  });

  await s3Client.send(new CreateBucketCommand({ Bucket: "orvo-test" }));
  console.log("Created MinIO bucket 'orvo-test'.");

  return container;
};

export default globalSetup;
