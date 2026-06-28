import type { ChildProcess } from "node:child_process";
import type { FullConfig } from "@playwright/test";
import { stopAppServer } from "../helpers";

type GlobalTestContainers = {
  postgres?: { stop: () => Promise<void> };
  clickhouse?: { stop: () => Promise<void> };
  minio?: { stop: () => Promise<void> };
  appServer?: ChildProcess;
};

const globalTeardown = async (_config: FullConfig) => {
  const containers = (
    global as typeof globalThis & { __TESTCONTAINER__?: GlobalTestContainers }
  ).__TESTCONTAINER__;

  await stopAppServer(containers?.appServer);

  if (containers?.minio) {
    await containers.minio.stop();
  }

  if (containers?.clickhouse) {
    await containers.clickhouse.stop();
  }

  if (containers?.postgres) {
    await containers.postgres.stop();
  }
};

export default globalTeardown;
