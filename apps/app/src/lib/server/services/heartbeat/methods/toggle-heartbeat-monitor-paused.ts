import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { toggleHeartbeatMonitorPausedInputSchema } from "../schema";
import { buildHeartbeatIncidentSourceKey } from "../shared";

const createToggleHeartbeatMonitorPaused = ({
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
  input: z.input<typeof toggleHeartbeatMonitorPausedInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = toggleHeartbeatMonitorPausedInputSchema.safeParse(input);
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

    const pausedAt = existing.pausedAt ? null : new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(heartbeatMonitor)
        .set({
          pausedAt,
          updatedBy: context.userId,
        })
        .where(eq(heartbeatMonitor.id, existing.id));

      if (pausedAt) {
        await incidentService.resolveOpenIncidentBySourceKey(
          {
            appId: context.appId,
            sourceKey: buildHeartbeatIncidentSourceKey(existing.id),
            now: pausedAt,
            actorUserId: context.userId,
            metadata: {
              reason: "heartbeat_monitor_paused",
            },
          },
          tx,
        );
      }
    });

    return ok({ paused: !!pausedAt });
  } catch (error) {
    recordError(error);
    logger.error("Failed to update heartbeat monitor", error as Error);
    return err("Failed to update heartbeat monitor.");
  }
};

export { createToggleHeartbeatMonitorPaused };
