import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  app,
  heartbeatMonitor,
  heartbeatMonitorDestination,
  notificationDelivery,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { sendHeartbeatMonitorTestAlertInputSchema } from "../schema";
import { buildHeartbeatUrl } from "../shared";

const createSendHeartbeatMonitorTestAlert = ({
  db,
  logger,
  config,
}: {
  db: DB;
  logger: Logger;
  config: { ingestBaseUrl: string };
}) => async (
  input: z.input<typeof sendHeartbeatMonitorTestAlertInputSchema>,
  context: { appId: string },
) => {
  const validated = sendHeartbeatMonitorTestAlertInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const monitor = await db.query.heartbeatMonitor.findFirst({
      where: and(
        eq(heartbeatMonitor.id, validated.data),
        eq(heartbeatMonitor.appId, context.appId),
      ),
    });

    if (!monitor) {
      return err("Heartbeat monitor not found.");
    }

    const currentApp = await db.query.app.findFirst({
      where: eq(app.id, context.appId),
    });

    if (!currentApp) {
      return err("App not found.");
    }

    const links = await db.query.heartbeatMonitorDestination.findMany({
      where: eq(heartbeatMonitorDestination.heartbeatMonitorId, monitor.id),
    });

    if (links.length === 0) {
      return err("Attach at least one notification destination first.");
    }

    const now = new Date();
    const payload = {
      type: "destination.test",
      timestamp: now.toISOString(),
      app: {
        id: currentApp.id,
        name: currentApp.name,
      },
      heartbeat: {
        id: monitor.id,
        name: monitor.name,
        expectedEverySeconds: monitor.expectedEverySeconds,
        graceSeconds: monitor.graceSeconds,
        lastCheckInAt: monitor.lastCheckInAt?.toISOString() ?? null,
        pingUrl: buildHeartbeatUrl(config.ingestBaseUrl, monitor.token),
      },
    } satisfies Record<string, unknown>;

    await db.insert(notificationDelivery).values(
      links.map((link) => ({
        id: genId("ntdl"),
        appId: currentApp.id,
        destinationId: link.destinationId,
        sourceKind: "heartbeat" as const,
        sourceId: monitor.id,
        eventType: "destination.test" as const,
        payload,
        status: "pending" as const,
        nextAttemptAt: now,
      })),
    );

    return ok({ deliveryCount: links.length });
  } catch (error) {
    recordError(error);
    logger.error("Failed to send test alert", error as Error);
    return err("Failed to send test alert.");
  }
};

export { createSendHeartbeatMonitorTestAlert };
