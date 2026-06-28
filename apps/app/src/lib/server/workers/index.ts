import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createWorkerContainer } from "$lib/server/container";
import { Logger } from "@repo/logger";
import { PgBoss } from "pg-boss";

import { HeartbeatWorker } from "./heartbeat-worker";
import { NotificationDeliveryWorker } from "./notification-delivery-worker";
import { ThresholdAlertWorker } from "./threshold-alert-worker";
import { WorkerManager } from "./worker-manager";

const globalWorkers = globalThis as typeof globalThis & {
  __orvoWorkerManagerStartPromise?: Promise<void>;
};

const ensureWorkersStarted = (logger: Logger) => {
  if (building) {
    return Promise.resolve();
  }

  if (!globalWorkers.__orvoWorkerManagerStartPromise) {
    globalWorkers.__orvoWorkerManagerStartPromise = startWorkers(logger);
  }

  return globalWorkers.__orvoWorkerManagerStartPromise;
};

const startWorkers = async (logger: Logger) => {
  const workerLogger = logger.child("WorkerRuntime");
  const boss = new PgBoss({
    connectionString: env.POSTGRES_URL,
    migrate: true,
  });
  const container = createWorkerContainer(workerLogger);
  const manager = new WorkerManager(boss, workerLogger, [
    new HeartbeatWorker(workerLogger, container.heartbeatService),
    new ThresholdAlertWorker(
      workerLogger,
      container.db,
      container.clickhouse,
      container.incidentService,
      {
        appBaseUrl: env.ORIGIN,
      },
    ),
    new NotificationDeliveryWorker(
      workerLogger,
      container.notificationDeliveryService,
    ),
  ]);

  await manager.start();
};

export { ensureWorkersStarted };
