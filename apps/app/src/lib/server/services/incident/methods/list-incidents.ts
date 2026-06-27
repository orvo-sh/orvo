import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { incident } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { listIncidentsInputSchema } from "../schema";
import { normalizeSourceSnapshot } from "../shared";

const createListIncidents = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof listIncidentsInputSchema>,
  context: { appId: string },
) => {
  const validated = listIncidentsInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const whereClauses = [eq(incident.appId, context.appId)];

    if (validated.data.status !== "all") {
      whereClauses.push(eq(incident.status, validated.data.status));
    }

    if (validated.data.sourceType) {
      whereClauses.push(eq(incident.sourceType, validated.data.sourceType));
    }

    if (validated.data.sourceId) {
      whereClauses.push(eq(incident.sourceId, validated.data.sourceId));
    }

    if (validated.data.entityId) {
      whereClauses.push(eq(incident.entityId, validated.data.entityId));
    }

    const incidents = await db.query.incident.findMany({
      where: and(...whereClauses),
      orderBy: [desc(incident.openedAt)],
      limit: validated.data.limit,
    });

    return ok({
      incidents: incidents.map((row) => ({
        ...row,
        sourceSnapshot: normalizeSourceSnapshot(row.sourceSnapshot),
      })),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load incidents", error as Error);
    return err("Failed to load incidents.");
  }
};

export { createListIncidents };
