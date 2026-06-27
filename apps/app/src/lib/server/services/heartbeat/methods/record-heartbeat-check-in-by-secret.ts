import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { app, heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { recordHeartbeatCheckInBySecretInputSchema } from "../schema";
import { buildHeartbeatIncidentSourceKey } from "../shared";

const createRecordHeartbeatCheckInBySecret = ({
  db,
  logger,
  incidentService,
  insertHeartbeatDeliveries,
}: {
  db: DB;
  logger: Logger;
  incidentService: {
    recoverSourceIncident: (
      input: {
        appId: string;
        sourceKey: string;
        now: Date;
        eventType: "heartbeat.recovered";
        eventMetadata?: Record<string, unknown>;
        lastObservedValue?: number | null;
      },
      tx?: Tx,
    ) => Promise<{
      mode: "none" | "resolved_open" | "cleared_dismissed_suppression" | "noop";
      incident: { id: string } | null;
    }>;
  };
  insertHeartbeatDeliveries: (
    currentDb: DB | Tx,
    heartbeatMonitorId: string,
    incidentId: string,
    eventType: "heartbeat.missed" | "heartbeat.recovered",
    now: Date,
  ) => Promise<void>;
}) => async (
  input: z.input<typeof recordHeartbeatCheckInBySecretInputSchema>,
) => {
  const validated = recordHeartbeatCheckInBySecretInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.heartbeatMonitor.findFirst({
      where: eq(heartbeatMonitor.token, validated.data.secretToken),
    });

    if (!existing) {
      return err("Heartbeat monitor not found.");
    }

    const now = new Date();
    const recovered = existing.status === "missed";

    await db.transaction(async (tx) => {
      await tx
        .update(heartbeatMonitor)
        .set({
          lastCheckInAt: now,
          status: "healthy",
        })
        .where(eq(heartbeatMonitor.id, existing.id));

      await tx
        .update(app)
        .set({
          heartbeatsFirstReceivedAt: now,
        })
        .where(
          and(
            eq(app.id, existing.appId),
            isNull(app.heartbeatsFirstReceivedAt),
          ),
        );

      if (recovered) {
        const recovery = await incidentService.recoverSourceIncident(
          {
            appId: existing.appId,
            sourceKey: buildHeartbeatIncidentSourceKey(existing.id),
            now,
            eventType: "heartbeat.recovered",
            eventMetadata: {
              heartbeatMonitorId: existing.id,
            },
          },
          tx,
        );

        if (recovery.mode === "resolved_open" && recovery.incident) {
          await insertHeartbeatDeliveries(
            tx,
            existing.id,
            recovery.incident.id,
            "heartbeat.recovered",
            now,
          );
        }
      }
    });

    return ok({
      appId: existing.appId,
      receivedAt: now.toISOString(),
      recovered,
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to record heartbeat check-in", error as Error);
    return err("Failed to record heartbeat check-in.");
  }
};

export { createRecordHeartbeatCheckInBySecret };
