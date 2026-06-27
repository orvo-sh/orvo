import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { heartbeatMonitor, heartbeatMonitorDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, generateRandomString, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createHeartbeatMonitorInputSchema } from "../schema";
import { buildHeartbeatUrl, uniqueValues } from "../shared";

const createCreateHeartbeatMonitor = ({
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
}) => async (
  input: z.input<typeof createHeartbeatMonitorInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = createHeartbeatMonitorInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const destinationIds = uniqueValues(validated.data.destinationIds);
    const destinations = await loadDestinations(context.appId, destinationIds);

    if (!destinations.success) {
      return destinations;
    }

    const id = genId("hbmt");
    const token = generateRandomString(48);

    await db.transaction(async (tx) => {
      await tx.insert(heartbeatMonitor).values({
        id,
        appId: context.appId,
        name: validated.data.name,
        token,
        expectedEverySeconds: validated.data.expectedEverySeconds,
        graceSeconds: validated.data.graceSeconds,
        createdBy: context.userId,
        updatedBy: context.userId,
      });

      if (destinationIds.length > 0) {
        await tx.insert(heartbeatMonitorDestination).values(
          destinationIds.map((destinationId) => ({
            heartbeatMonitorId: id,
            destinationId,
          })),
        );
      }
    });

    return ok({
      id,
      secretUrl: buildHeartbeatUrl(config.ingestBaseUrl, token),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create heartbeat monitor", error as Error);
    return err("Failed to create heartbeat monitor.");
  }
};

export { createCreateHeartbeatMonitor };
