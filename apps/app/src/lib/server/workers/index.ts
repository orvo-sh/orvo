import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createWorkerContainer } from "$lib/server/container";
import { mode } from "$lib/server/mode";
import { context } from "@opentelemetry/api";
import { suppressTracing } from "@opentelemetry/core";
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
    globalWorkers.__orvoWorkerManagerStartPromise =
      mode === "cloud" ? startCloudWorkers(logger) : startLocalWorkers(logger);
  }

  return globalWorkers.__orvoWorkerManagerStartPromise;
};

const startCloudWorkers = async (logger: Logger) => {
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

  await context.with(suppressTracing(context.active()), async () => {
    await manager.start();
  });
};

const startLocalWorkers = async (logger: Logger) => {
  const workerLogger = logger.child("LocalWorkerRuntime");
  const container = createWorkerContainer(workerLogger);
  const workers = [
    new HeartbeatWorker(workerLogger, container.heartbeatService),
    new ThresholdAlertWorker(
      workerLogger,
      container.db,
      container.clickhouse,
      container.incidentService,
      { appBaseUrl: env.ORIGIN },
    ),
    new NotificationDeliveryWorker(
      workerLogger,
      container.notificationDeliveryService,
    ),
  ];
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      for (const worker of workers) await worker.execute();
    } catch (error) {
      workerLogger.error("LocalWorkerRuntime: worker cycle failed", error as Error);
    } finally {
      running = false;
    }
  };

  await run();
  setInterval(() => void run(), 60_000).unref();
  workerLogger.info("LocalWorkerRuntime: workers started", {
    workers: workers.map((worker) => worker.name),
  });
};

export { ensureWorkersStarted };
