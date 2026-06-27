import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  incident,
  incidentEvent,
  notificationDelivery,
  notificationDestination,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getIncidentInputSchema } from "../schema";
import { normalizeSourceSnapshot } from "../shared";

const createGetIncidentDetail = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof getIncidentInputSchema>,
  context: { appId: string },
) => {
  const validated = getIncidentInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const row = await db.query.incident.findFirst({
      where: and(
        eq(incident.id, validated.data),
        eq(incident.appId, context.appId),
      ),
    });

    if (!row) {
      return err("Incident not found.");
    }

    const [events, deliveries] = await Promise.all([
      db.query.incidentEvent.findMany({
        where: eq(incidentEvent.incidentId, row.id),
        orderBy: [asc(incidentEvent.occurredAt)],
      }),
      db
        .select({
          delivery: notificationDelivery,
          destinationName: notificationDestination.name,
          destinationKind: notificationDestination.kind,
        })
        .from(notificationDelivery)
        .leftJoin(
          notificationDestination,
          eq(notificationDelivery.destinationId, notificationDestination.id),
        )
        .where(eq(notificationDelivery.incidentId, row.id))
        .orderBy(notificationDelivery.createdAt),
    ]);

    return ok({
      incident: {
        ...row,
        sourceSnapshot: normalizeSourceSnapshot(row.sourceSnapshot),
      },
      events: events.map((event) => ({
        ...event,
        metadata: normalizeSourceSnapshot(event.metadata),
      })),
      deliveries: deliveries.map(
        ({ delivery, destinationKind, destinationName }) => ({
          ...delivery,
          destinationName,
          destinationKind,
        }),
      ),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load incident", error as Error);
    return err("Failed to load incident.");
  }
};

export { createGetIncidentDetail };
