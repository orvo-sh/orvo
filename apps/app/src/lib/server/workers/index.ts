import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createWorkerContainer } from "$lib/server/container";
import { mode } from "$lib/server/mode";
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

const startLocalWorkers = async (logger: Logger) => {
  const workerLogger = logger.child("LocalWorkerRuntime");
  const container = createWorkerContainer(workerLogger);
  if (container.billingService) {
    const reconciliation = new BillingReconciliationWorker(
      workerLogger,
      container.billingService,
    );
    let reconciling = false;
    const reconcile = async () => {
      if (reconciling) return;
      reconciling = true;
      try {
        await reconciliation.execute();
      } catch (error) {
        workerLogger.error(
          "LocalWorkerRuntime: billing reconciliation failed",
          error as Error,
        );
      } finally {
        reconciling = false;
      }
    };
    void reconcile();
    setInterval(() => void reconcile(), 6 * 60 * 60_000).unref();
  }
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
      workerLogger.error(
        "LocalWorkerRuntime: worker cycle failed",
        error as Error,
      );
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

const enqueueSlackScoutRun = async (job: SlackScoutJob) => {
  if (mode !== "cloud") {
    throw new Error("Slack Scout jobs are only available in cloud mode.");
  }
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
