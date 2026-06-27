import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";

import type { OpenIncidentInput } from "../shared";

const createOpenOrGetIncident = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: OpenIncidentInput,
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

    if (existing) {
      return {
        opened: false,
        suppressed: false,
        incident: existing,
      };
    }

    const latest = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
      ),
      orderBy: [desc(incident.openedAt)],
    });

    if (latest?.status === "dismissed" && latest.suppressedUntilRecovered) {
      return {
        opened: false,
        suppressed: true,
        incident: latest,
      };
    }

    const now = input.now ?? new Date();
    const incidentId = input.id ?? genId("inc");

    await database.insert(incident).values({
      id: incidentId,
      appId: input.appId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      type: input.type,
      title: input.title,
      severity: input.severity,
      status: "open",
      serviceName: input.serviceName ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName ?? null,
      sourceSnapshot: input.sourceSnapshot,
      openedAt: now,
      lastObservedAt: input.lastObservedAt ?? now,
      lastObservedValue: input.lastObservedValue ?? null,
      lastNotifiedAt: input.lastNotifiedAt ?? null,
      renotifyCount: input.renotifyCount ?? 0,
    });

    await database.insert(incidentEvent).values([
      {
        id: genId("inev"),
        appId: input.appId,
        incidentId,
        eventType: "incident.opened",
        occurredAt: now,
        metadata: input.openMetadata ?? {},
      },
      {
        id: genId("inev"),
        appId: input.appId,
        incidentId,
        eventType: input.triggerEventType,
        occurredAt: now,
        metadata: input.triggerMetadata ?? {},
      },
    ]);

    const created = await database.query.incident.findFirst({
      where: eq(incident.id, incidentId),
    });

    if (!created) {
      throw new Error("Failed to load created incident.");
    }

    return {
      opened: true,
      suppressed: false,
      incident: created,
    };
  } catch (error) {
    recordError(error);
    logger.error("Failed to open incident", error as Error);
    throw error;
  }
};

export { createOpenOrGetIncident };
