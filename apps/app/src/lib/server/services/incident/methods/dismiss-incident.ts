import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dismissIncidentInputSchema } from "../schema";

const createDismissIncident = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof dismissIncidentInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = dismissIncidentInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.incident.findFirst({
      where: and(
        eq(incident.id, validated.data.id),
        eq(incident.appId, context.appId),
        eq(incident.status, "open"),
      ),
    });

    if (!existing) {
      return err("Incident not found.");
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(incident)
        .set({
          status: "dismissed",
          dismissedAt: now,
          dismissedReason: validated.data.reason,
          dismissedReasonText: validated.data.reasonText ?? null,
          dismissedBy: context.userId,
          suppressedUntilRecovered: true,
        })
        .where(eq(incident.id, existing.id));

      await tx.insert(incidentEvent).values({
        id: genId("inev"),
        appId: existing.appId,
        incidentId: existing.id,
        eventType: "incident.dismissed",
        occurredAt: now,
        actorUserId: context.userId,
        metadata: {
          reason: validated.data.reason,
          reasonText: validated.data.reasonText ?? null,
        },
      });
    });

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to dismiss incident", error as Error);
    return err("Failed to dismiss incident.");
  }
};

export { createDismissIncident };
