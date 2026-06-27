import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { resolveIncidentInputSchema } from "../schema";

const createResolveIncident = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof resolveIncidentInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = resolveIncidentInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.incident.findFirst({
      where: and(
        eq(incident.id, validated.data),
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
          status: "resolved",
          resolvedAt: now,
        })
        .where(eq(incident.id, existing.id));

      await tx.insert(incidentEvent).values({
        id: genId("inev"),
        appId: existing.appId,
        incidentId: existing.id,
        eventType: "incident.resolved",
        occurredAt: now,
        actorUserId: context.userId,
        metadata: {
          manual: true,
        },
      });
    });

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to resolve incident", error as Error);
    return err("Failed to resolve incident.");
  }
};

export { createResolveIncident };
