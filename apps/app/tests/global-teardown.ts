import type { FullConfig } from "@playwright/test";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { ChildProcess } from "node:child_process";

const globalTeardown = async (_config: FullConfig) => {
  const container = (
    global as typeof globalThis & {
      __TESTCONTAINER__?: {
        postgres?: StartedPostgreSqlContainer;
        appServer?: ChildProcess;
      };
    }
  ).__TESTCONTAINER__;

  if (container?.appServer) {
    console.log("Stopping app test server.");
    container.appServer.kill("SIGTERM");
  }

  if (container?.postgres) {
    console.log("Stopping PostgreSQL container.");
    await container.postgres.stop();
  }
};

export default globalTeardown;
