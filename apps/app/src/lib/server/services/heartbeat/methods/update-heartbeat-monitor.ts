import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { heartbeatMonitor, heartbeatMonitorDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { updateHeartbeatMonitorInputSchema } from "../schema";
import { uniqueValues } from "../shared";

const createUpdateHeartbeatMonitor = ({
  db,
  logger,
  loadDestinations,
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
}) => async (
  input: z.input<typeof updateHeartbeatMonitorInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = updateHeartbeatMonitorInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.heartbeatMonitor.findFirst({
      where: and(
        eq(heartbeatMonitor.id, validated.data.id),
        eq(heartbeatMonitor.appId, context.appId),
      ),
    });

    if (!existing) {
      return err("Heartbeat monitor not found.");
    }

    const destinationIds = uniqueValues(validated.data.destinationIds);
    const destinations = await loadDestinations(context.appId, destinationIds);

    if (!destinations.success) {
      return destinations;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(heartbeatMonitor)
        .set({
          name: validated.data.name,
          expectedEverySeconds: validated.data.expectedEverySeconds,
          graceSeconds: validated.data.graceSeconds,
          updatedBy: context.userId,
        })
        .where(eq(heartbeatMonitor.id, existing.id));

      await tx
        .delete(heartbeatMonitorDestination)
        .where(eq(heartbeatMonitorDestination.heartbeatMonitorId, existing.id));

      if (destinationIds.length > 0) {
        await tx.insert(heartbeatMonitorDestination).values(
          destinationIds.map((destinationId) => ({
            heartbeatMonitorId: existing.id,
            destinationId,
          })),
        );
      }
    });

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to update heartbeat monitor", error as Error);
    return err("Failed to update heartbeat monitor.");
  }
};

export { createUpdateHeartbeatMonitor };
