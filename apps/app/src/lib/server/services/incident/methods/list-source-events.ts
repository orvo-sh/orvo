import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";

const createListSourceEvents =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: {
      sourceType: "alert" | "heartbeat";
      sourceId: string;
      limit: number;
    },
    context: { appId: string },
  ) => {
    try {
      const events = await db
        .select({
          id: incidentEvent.id,
          incidentId: incidentEvent.incidentId,
          eventType: incidentEvent.eventType,
          occurredAt: incidentEvent.occurredAt,
          metadata: incidentEvent.metadata,
          incidentTitle: incident.title,
        })
        .from(incidentEvent)
        .innerJoin(incident, eq(incident.id, incidentEvent.incidentId))
        .where(
          and(
            eq(incident.appId, context.appId),
            eq(incident.sourceType, input.sourceType),
            eq(incident.sourceId, input.sourceId),
          ),
        )
        .orderBy(desc(incidentEvent.occurredAt))
        .limit(input.limit);

      return ok({ events });
    } catch (error) {
      recordError(error);
      logger.error("Failed to load incident source events", error as Error);
      return err("Failed to load incident activity.");
    }
  };

export { createListSourceEvents };
