import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { incidentEventTypeSchema } from "../schema";

const createTouchIncident = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: {
    id: string;
    appId: string;
    lastObservedAt: Date;
    lastObservedValue?: number | null;
    lastNotifiedAt?: Date | null;
    renotifyCount?: number;
    eventType?: z.infer<typeof incidentEventTypeSchema>;
    eventMetadata?: Record<string, unknown>;
  },
  tx?: Tx,
) => {
  try {
    const database = tx ?? db;
    const updateValues: {
      lastObservedAt: Date;
      lastObservedValue?: number | null;
      lastNotifiedAt?: Date | null;
      renotifyCount?: number;
    } = {
      lastObservedAt: input.lastObservedAt,
    };

    if (input.lastObservedValue !== undefined) {
      updateValues.lastObservedValue = input.lastObservedValue;
    }

    if (input.lastNotifiedAt !== undefined) {
      updateValues.lastNotifiedAt = input.lastNotifiedAt;
    }

    if (input.renotifyCount !== undefined) {
      updateValues.renotifyCount = input.renotifyCount;
    }

    await database
      .update(incident)
      .set(updateValues)
      .where(and(eq(incident.id, input.id), eq(incident.appId, input.appId)));

    if (input.eventType) {
      await database.insert(incidentEvent).values({
        id: genId("inev"),
        appId: input.appId,
        incidentId: input.id,
        eventType: input.eventType,
        occurredAt: input.lastObservedAt,
        metadata: input.eventMetadata ?? {},
      });
    }
  } catch (error) {
    recordError(error);
    logger.error("Failed to touch incident", error as Error);
    throw error;
  }
};

export { createTouchIncident };
