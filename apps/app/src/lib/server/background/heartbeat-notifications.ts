import { building, dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { Email } from "$lib/server/email";
import { HeartbeatService } from "$lib/server/services/heartbeat.service";
import { NotificationDeliveryService } from "$lib/server/services/notification-delivery.service";
import { getDb } from "@repo/db";
import { Encryption } from "@repo/encryption";
import { Logger } from "@repo/logger";
import { PgBoss } from "pg-boss";

let startPromise: Promise<void> | null = null;

const ensureHeartbeatNotificationBackgroundJobs = (logger: Logger) => {
  if (building || startPromise) {
    return startPromise ?? Promise.resolve();
  }

  startPromise = start(logger);
  return startPromise;
};

const start = async (logger: Logger) => {
  const boss = new PgBoss({
    connectionString: env.POSTGRES_URL,
    migrate: true,
  });
  const db = getDb(env.POSTGRES_URL);
  const encryption = new Encryption({ secret: env.ENCRYPTION_SECRET });
  const email = new Email({
    resendApiKey: env.RESEND_API_KEY,
    transport: dev ? "console" : "resend",
  });
  const heartbeatService = new HeartbeatService(db, logger, {
    ingestBaseUrl: "https://ingest.orvo.sh",
  });
  const notificationDeliveryService = new NotificationDeliveryService(
    db,
    logger,
    encryption,
    email,
  );

  boss.on("error", (error) => {
    logger.error(
      "Heartbeat notification background jobs failed",
      error instanceof Error ? error : undefined,
    );
  });

  await boss.start();
  await boss.schedule("heartbeat-evaluations", "* * * * *", {}, {
    key: "heartbeat-evaluations",
  });
  await boss.schedule("notification-deliveries", "* * * * *", {}, {
    key: "notification-deliveries",
  });
  await boss.work("heartbeat-evaluations", async () => {
    await heartbeatService.evaluateDueMonitors();
  });
  await boss.work("notification-deliveries", async () => {
    await notificationDeliveryService.processDueDeliveries();
  });

  logger.info("Heartbeat notification background jobs started");
};

export { ensureHeartbeatNotificationBackgroundJobs };
