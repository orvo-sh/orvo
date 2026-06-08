import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FullConfig } from "@playwright/test";
import { getDb } from "@repo/db";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate as postgresMigrator } from "drizzle-orm/postgres-js/migrator";

const TEST_APP_PORT = 42173;
const TEST_APP_ORIGIN = `http://127.0.0.1:${TEST_APP_PORT}`;

const globalSetup = async (_config: FullConfig) => {
  const postgresContainer = await setupPostgresContainer();

  process.env.NODE_ENV = "test";
  process.env.MODE = "test";
  process.env.POSTGRES_URL = postgresContainer.getConnectionUri();
  process.env.CLICKHOUSE_URL = "http://127.0.0.1:8123";
  process.env.ORIGIN = TEST_APP_ORIGIN;
  process.env.BETTER_AUTH_SECRET = crypto.randomUUID();
  process.env.ALERTS_ENCRYPTION_KEY = crypto.randomUUID();

  const appServer = await startAppServer();

  (
    global as typeof globalThis & {
      __TESTCONTAINER__?: {
        postgres: StartedPostgreSqlContainer;
        appServer: ChildProcess;
      };
    }
  ).__TESTCONTAINER__ = {
    postgres: postgresContainer,
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

export default globalSetup;
