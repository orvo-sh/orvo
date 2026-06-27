import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { deleteHeartbeatMonitorInputSchema } from "../schema";
import { buildHeartbeatIncidentSourceKey } from "../shared";

const createDeleteHeartbeatMonitor = ({
  db,
  logger,
  incidentService,
}: {
  db: DB;
  logger: Logger;
  incidentService: {
    resolveOpenIncidentBySourceKey: (
      input: {
        appId: string;
        sourceKey: string;
        now: Date;
        actorUserId?: string;
        metadata?: Record<string, unknown>;
        lastObservedValue?: number | null;
      },
      tx?: Tx,
    ) => Promise<unknown>;
  };
}) => async (
  input: z.input<typeof deleteHeartbeatMonitorInputSchema>,
  context: { appId: string },
) => {
  const validated = deleteHeartbeatMonitorInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.heartbeatMonitor.findFirst({
      where: and(
        eq(heartbeatMonitor.id, validated.data),
        eq(heartbeatMonitor.appId, context.appId),
      ),
    });

    if (!existing) {
      return err("Heartbeat monitor not found.");
    }

    await db.transaction(async (tx) => {
      await incidentService.resolveOpenIncidentBySourceKey(
        {
          appId: context.appId,
          sourceKey: buildHeartbeatIncidentSourceKey(existing.id),
          now: new Date(),
          metadata: {
            reason: "heartbeat_monitor_deleted",
          },
        },
        tx,
      );

      await tx.delete(heartbeatMonitor).where(eq(heartbeatMonitor.id, existing.id));
    });

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to delete heartbeat monitor", error as Error);
    return err("Failed to delete heartbeat monitor.");
  }
};

export { createDeleteHeartbeatMonitor };
