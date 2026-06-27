import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { asc, eq } from "drizzle-orm";

import { buildHeartbeatUrl } from "../shared";

const createListHeartbeatMonitors = ({
  db,
  logger,
  config,
}: {
  db: DB;
  logger: Logger;
  config: { ingestBaseUrl: string };
}) => async (
  context: { appId: string },
) => {
  try {
    const monitors = await db.query.heartbeatMonitor.findMany({
      where: eq(heartbeatMonitor.appId, context.appId),
      with: {
        destinations: {
          columns: {
            destinationId: true,
          },
        },
      },
      orderBy: [asc(heartbeatMonitor.name)],
    });

    if (monitors.length === 0) {
      return ok({ monitors: [] });
    }

    return ok({
      monitors: monitors.map((monitor) => ({
        ...monitor,
        destinationIds: monitor.destinations.map(
          (destination) => destination.destinationId,
        ),
        isPaused: !!monitor.pausedAt,
        url: buildHeartbeatUrl(config.ingestBaseUrl, monitor.token),
      })),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load heartbeat monitors", error as Error);
    return err("Failed to load heartbeat monitors.");
  }
};

export { createListHeartbeatMonitors };
