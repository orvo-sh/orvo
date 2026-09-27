import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { heartbeatMonitor, heartbeatMonitorDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, generateRandomString, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createHeartbeatMonitorsInputSchema } from "../schema";
import { buildHeartbeatUrl, uniqueValues } from "../shared";

const createCreateHeartbeatMonitors =
  ({
    db,
    logger,
    loadDestinations,
    config,
  }: {
    db: DB;
    logger: Logger;
    loadDestinations: (
      appId: string,
      destinationIds: string[],
    ) => Promise<
      | { success: true; data: { destinations: unknown[] } }
      | { success: false; error: string }
    >;
    config: { ingestBaseUrl: string };
  }) =>
  async (
    input: z.input<typeof createHeartbeatMonitorsInputSchema>,
    context: { appId: string; userId: string },
  ) => {
    const validated = createHeartbeatMonitorsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const destinationIds = uniqueValues(
        validated.data.monitors.flatMap((monitor) => monitor.destinationIds),
      );
      const destinations = await loadDestinations(
        context.appId,
        destinationIds,
      );

      if (!destinations.success) {
        return destinations;
      }

      const monitors = validated.data.monitors.map((monitor) => ({
        ...monitor,
        destinationIds: uniqueValues(monitor.destinationIds),
        id: genId("hbmt"),
        token: generateRandomString(48),
      }));

      await db.transaction(async (tx) => {
        await tx.insert(heartbeatMonitor).values(
          monitors.map((monitor) => ({
            id: monitor.id,
            appId: context.appId,
            name: monitor.name,
            token: monitor.token,
            expectedEverySeconds: monitor.expectedEverySeconds,
            graceSeconds: monitor.graceSeconds,
            createdBy: context.userId,
            updatedBy: context.userId,
          })),
        );

        const links = monitors.flatMap((monitor) =>
          monitor.destinationIds.map((destinationId) => ({
            heartbeatMonitorId: monitor.id,
            destinationId,
          })),
        );
        if (links.length > 0) {
          await tx.insert(heartbeatMonitorDestination).values(links);
        }
      });

      return ok({
        monitors: monitors.map((monitor) => ({
          id: monitor.id,
          name: monitor.name,
          secretUrl: buildHeartbeatUrl(config.ingestBaseUrl, monitor.token),
        })),
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "createHeartbeatMonitors: failed to create heartbeat monitors",
        error as Error,
      );
      return err("Failed to create heartbeat monitors.");
    }
  };

export { createCreateHeartbeatMonitors };
