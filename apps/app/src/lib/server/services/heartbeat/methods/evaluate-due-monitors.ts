import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { resolveHeartbeatStatus } from "../shared";

const createEvaluateDueMonitors =
  ({
    db,
    logger,
    openHeartbeatIncident,
    insertHeartbeatDeliveries,
  }: {
    db: DB;
    logger: Logger;
    openHeartbeatIncident: (
      currentDb: DB | Tx,
      heartbeatMonitorId: string,
      now: Date,
    ) => Promise<{
      opened: boolean;
      incident: { id: string } | null;
    } | null>;
    insertHeartbeatDeliveries: (
      currentDb: DB | Tx,
      heartbeatMonitorId: string,
      incidentId: string,
      eventType: "heartbeat.missed" | "heartbeat.recovered",
      now: Date,
    ) => Promise<void>;
  }) =>
  async () => {
    try {
      const monitors = await db.query.heartbeatMonitor.findMany({
        where: and(
          isNotNull(heartbeatMonitor.lastCheckInAt),
          isNull(heartbeatMonitor.pausedAt),
        ),
      });
      const now = new Date();
      let updated = 0;
      let newlyMissed = 0;

      for (const monitor of monitors) {
        const status = resolveHeartbeatStatus({
          lastCheckInAt: monitor.lastCheckInAt,
          expectedEverySeconds: monitor.expectedEverySeconds,
          graceSeconds: monitor.graceSeconds,
          now,
        });

        if (status === monitor.status) {
          continue;
        }

        const changed = await db.transaction(async (tx) => {
          const rows = await tx
            .update(heartbeatMonitor)
            .set({ status })
            .where(
              and(
                eq(heartbeatMonitor.id, monitor.id),
                eq(heartbeatMonitor.status, monitor.status),
                eq(heartbeatMonitor.lastCheckInAt, monitor.lastCheckInAt!),
              ),
            )
            .returning({ id: heartbeatMonitor.id });

          if (rows.length === 0) {
            return { updated: false, newlyMissed: false };
          }

          if (status === "missed" && monitor.status !== "missed") {
            const opened = await openHeartbeatIncident(tx, monitor.id, now);
            if (opened?.opened && opened.incident) {
              await insertHeartbeatDeliveries(
                tx,
                monitor.id,
                opened.incident.id,
                "heartbeat.missed",
                now,
              );
            }

            return { updated: true, newlyMissed: true };
          }

          return { updated: true, newlyMissed: false };
        });

        if (changed.updated) updated += 1;
        if (changed.newlyMissed) newlyMissed += 1;
      }

      return ok({ updated, newlyMissed });
    } catch (error) {
      recordError(error);
      logger.error("Failed to evaluate heartbeat monitors", error as Error);
      return err("Failed to evaluate heartbeat monitors.");
    }
  };

export { createEvaluateDueMonitors };
