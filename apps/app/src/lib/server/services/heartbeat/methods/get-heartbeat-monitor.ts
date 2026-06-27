import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  heartbeatMonitor,
  heartbeatMonitorDestination,
  notificationDestination,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getHeartbeatMonitorInputSchema } from "../schema";
import { buildHeartbeatUrl } from "../shared";

const createGetHeartbeatMonitor = ({
  db,
  logger,
  config,
}: {
  db: DB;
  logger: Logger;
  config: { ingestBaseUrl: string };
}) => async (
  input: z.input<typeof getHeartbeatMonitorInputSchema>,
  context: { appId: string },
) => {
  const validated = getHeartbeatMonitorInputSchema.safeParse(input);
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

    const links = await db.query.heartbeatMonitorDestination.findMany({
      where: eq(heartbeatMonitorDestination.heartbeatMonitorId, monitor.id),
    });
    const destinations = links.length
      ? await db.query.notificationDestination.findMany({
          where: and(
            eq(notificationDestination.appId, context.appId),
            inArray(
              notificationDestination.id,
              links.map((link) => link.destinationId),
            ),
          ),
          orderBy: [asc(notificationDestination.name)],
        })
      : [];

    return ok({
      monitor: {
        ...monitor,
        isPaused: !!monitor.pausedAt,
        destinationIds: links.map((link) => link.destinationId),
        destinations: destinations.map((destination) => ({
          id: destination.id,
          name: destination.name,
          kind: destination.kind,
        })),
        secretUrl: buildHeartbeatUrl(config.ingestBaseUrl, monitor.token),
      },
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load heartbeat monitor", error as Error);
    return err("Failed to load heartbeat monitor.");
  }
};

export { createGetHeartbeatMonitor };
