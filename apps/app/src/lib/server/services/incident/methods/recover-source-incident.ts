import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { incidentEventTypeSchema } from "../schema";

const createRecoverSourceIncident = ({
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
    eventType: z.infer<typeof incidentEventTypeSchema>;
    eventMetadata?: Record<string, unknown>;
    lastObservedValue?: number | null;
  },
  tx?: Tx,
) => {
  try {
    const database = tx ?? db;
    const latest = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
      ),
      orderBy: [desc(incident.openedAt)],
    });

    if (!latest) {
      return { mode: "none" as const, incident: null };
    }

    if (latest.status === "open") {
      await database
        .update(incident)
        .set({
          status: "resolved",
          resolvedAt: input.now,
          lastObservedAt: input.now,
          lastObservedValue: input.lastObservedValue ?? null,
        })
        .where(eq(incident.id, latest.id));

      await database.insert(incidentEvent).values([
        {
          id: genId("inev"),
          appId: latest.appId,
          incidentId: latest.id,
          eventType: input.eventType,
          occurredAt: input.now,
          metadata: input.eventMetadata ?? {},
        },
        {
          id: genId("inev"),
          appId: latest.appId,
          incidentId: latest.id,
          eventType: "incident.resolved",
          occurredAt: input.now,
          metadata: {
            automatic: true,
          },
        },
      ]);

      return {
        mode: "resolved_open" as const,
        incident: {
          ...latest,
          status: "resolved" as const,
          resolvedAt: input.now,
        },
      };
    }

    if (latest.status === "dismissed" && latest.suppressedUntilRecovered) {
      await database
        .update(incident)
        .set({
          suppressedUntilRecovered: false,
          lastObservedAt: input.now,
          lastObservedValue: input.lastObservedValue ?? null,
        })
        .where(eq(incident.id, latest.id));

      await database.insert(incidentEvent).values({
        id: genId("inev"),
        appId: latest.appId,
        incidentId: latest.id,
        eventType: input.eventType,
        occurredAt: input.now,
        metadata: {
          ...(input.eventMetadata ?? {}),
          clearedDismissalSuppression: true,
        },
      });

      return {
        mode: "cleared_dismissed_suppression" as const,
        incident: {
          ...latest,
          suppressedUntilRecovered: false,
        },
      };
    }

    return {
      mode: "noop" as const,
      incident: latest,
    };
  } catch (error) {
    recordError(error);
    logger.error("Failed to recover incident", error as Error);
    throw error;
  }
};

export { createRecoverSourceIncident };
