import type { FullConfig } from "@playwright/test";
import {
  applyClickHouseMigrations,
  ensureTestBucket,
  getClickHouseTestClient,
  startAppServer,
  startClickHouseContainer,
  startMinioContainer,
  startPostgresContainer,
  applyPostgresMigrations,
  TEST_APP_ORIGIN,
  TEST_BUCKET,
} from "../helpers";
import { getDb } from "@repo/db";

type GlobalTestContainers = {
  postgres: Awaited<ReturnType<typeof startPostgresContainer>>;
  clickhouse: Awaited<ReturnType<typeof startClickHouseContainer>>;
  minio: Awaited<ReturnType<typeof startMinioContainer>>;
  appServer: Awaited<ReturnType<typeof startAppServer>>;
};

const globalSetup = async (_config: FullConfig) => {
  const postgresContainer = await startPostgresContainer();
  process.env.NODE_ENV = "test";
  process.env.MODE = "test";
  process.env.POSTGRES_URL = postgresContainer.getConnectionUri();

  const db = getDb(postgresContainer.getConnectionUri());
  await applyPostgresMigrations(db);

  const clickhouseContainer = await startClickHouseContainer();
  const clickhouseClient = getClickHouseTestClient(clickhouseContainer);
  await applyClickHouseMigrations(clickhouseClient);
  await clickhouseClient.close();
  process.env.CLICKHOUSE_URL = clickhouseContainer.getConnectionUrl();

  process.env.ORIGIN = TEST_APP_ORIGIN;
  process.env.ENCRYPTION_SECRET =
    process.env.ENCRYPTION_SECRET ?? crypto.randomUUID();

  const minioContainer = await startMinioContainer();
  process.env.S3_ACCESS_KEY_ID = minioContainer.getUsername();
  process.env.S3_SECRET_ACCESS_KEY = minioContainer.getPassword();
  process.env.S3_ENDPOINT = minioContainer.getConnectionUrl();
  process.env.S3_REGION = "us-east-1";
  process.env.S3_BUCKET_NAME = TEST_BUCKET;
  process.env.CDN_BASE_URL = minioContainer.getConnectionUrl();
  await ensureTestBucket(minioContainer);

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

export default globalSetup;
