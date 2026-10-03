import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createWorkerContainer } from "$lib/server/container";
import { context } from "@opentelemetry/api";
import { suppressTracing } from "@opentelemetry/core";
import { Logger } from "@repo/logger";
import { PgBoss } from "pg-boss";

import { BillingMeterWorker } from "./billing-meter-worker";
import { BillingReconciliationWorker } from "./billing-reconciliation-worker";
import { HeartbeatWorker } from "./heartbeat-worker";
import { NotificationDeliveryWorker } from "./notification-delivery-worker";
import { ThresholdAlertWorker } from "./threshold-alert-worker";
import { SlackScoutWorker, type SlackScoutJob } from "./slack-scout-worker";
import { WorkerManager } from "./worker-manager";

const globalWorkers = globalThis as typeof globalThis & {
  __orvoWorkerManagerStartPromise?: Promise<void>;
  __orvoBoss?: PgBoss;
};

const ensureWorkersStarted = (logger: Logger) => {
  if (building) {
    return Promise.resolve();
  }

  if (!globalWorkers.__orvoWorkerManagerStartPromise) {
    globalWorkers.__orvoWorkerManagerStartPromise =
      startCloudWorkers(logger);
  }

  return globalWorkers.__orvoWorkerManagerStartPromise;
};

const startCloudWorkers = async (logger: Logger) => {
  const workerLogger = logger.child("WorkerRuntime");
  const boss = new PgBoss({
    connectionString: env.POSTGRES_URL,
    migrate: true,
  });
  globalWorkers.__orvoBoss = boss;
  const container = createWorkerContainer(workerLogger);
  const manager = new WorkerManager(boss, workerLogger, [
    ...(container.billingService
      ? [
          new BillingMeterWorker(workerLogger, container.billingService),
          new BillingReconciliationWorker(
            workerLogger,
            container.billingService,
          ),
        ]
      : []),
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
    new SlackScoutWorker(workerLogger, container.slackIntegrationService),
  ]);

  await context.with(suppressTracing(context.active()), async () => {
    await manager.start();
  });
  if (container.billingService) {
    void container.billingService.reconcileSubscriptions().catch((error) => {
      workerLogger.error(
        "WorkerRuntime: initial billing reconciliation failed",
        error as Error,
      );
    });
  }
};

const enqueueSlackScoutRun = async (job: SlackScoutJob) => {
  await globalWorkers.__orvoWorkerManagerStartPromise;
  const boss = globalWorkers.__orvoBoss;
  if (!boss) throw new Error("Slack Scout worker is not ready.");
  const singletonKey =
    job.kind === "message"
      ? `event:${job.eventId}`
      : `approval:${job.action.messageId}:${job.action.toolCallId}:${job.approved}`;
  return boss.send("slack-scout", job, {
    singletonKey,
    retryLimit: 3,
    retryDelay: 5,
  });
};

export { enqueueSlackScoutRun, ensureWorkersStarted };
