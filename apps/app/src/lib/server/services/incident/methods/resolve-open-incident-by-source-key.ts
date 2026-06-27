import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, eq } from "drizzle-orm";

const createResolveOpenIncidentBySourceKey = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: {
    appId: string;
    sourceKey: string;
    now: Date;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
    lastObservedValue?: number | null;
  },
  tx?: Tx,
) => {
  try {
    const database = tx ?? db;
    const existing = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
        eq(incident.status, "open"),
      ),
    });

    if (!existing) {
      return null;
    }

    await database
      .update(incident)
      .set({
        status: "resolved",
        resolvedAt: input.now,
        lastObservedAt: input.now,
        lastObservedValue: input.lastObservedValue ?? existing.lastObservedValue,
      })
      .where(eq(incident.id, existing.id));

    await database.insert(incidentEvent).values({
      id: genId("inev"),
      appId: existing.appId,
      incidentId: existing.id,
      eventType: "incident.resolved",
      occurredAt: input.now,
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? {},
    });

    return {
      ...existing,
      status: "resolved" as const,
      resolvedAt: input.now,
    };
  } catch (error) {
    recordError(error);
    logger.error("Failed to resolve open incident", error as Error);
    throw error;
  }
};

export { createResolveOpenIncidentBySourceKey };
