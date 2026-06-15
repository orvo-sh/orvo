import type { FullConfig } from "@playwright/test";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { ChildProcess } from "node:child_process";

const globalTeardown = async (_config: FullConfig) => {
  const container = (
    global as typeof globalThis & {
      __TESTCONTAINER__?: {
        postgres?: StartedPostgreSqlContainer;
        clickhouse?: { stop: () => Promise<void> };
        minio?: { stop: () => Promise<void> };
        appServer?: ChildProcess;
      };
    }
  ).__TESTCONTAINER__;

  if (container?.appServer) {
    console.log("Stopping app test server.");
    container.appServer.kill("SIGTERM");
  }

  if (container?.minio) {
    console.log("Stopping MinIO container.");
    await container.minio.stop();
  }

  if (container?.clickhouse) {
    console.log("Stopping ClickHouse container.");
    await container.clickhouse.stop();
  }

  if (container?.postgres) {
    console.log("Stopping PostgreSQL container.");
    await container.postgres.stop();
  }
};

export default globalTeardown;
