import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { incident } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { incidentSourceTypeSchema } from "../schema";

const createGetOpenIncidentCountBySourceIds = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (input: {
  appId: string;
  sourceType: z.infer<typeof incidentSourceTypeSchema>;
  sourceIds: string[];
}) => {
  try {
    if (input.sourceIds.length === 0) {
      return new Map<string, number>();
    }

    const rows = await db
      .select({
        sourceId: incident.sourceId,
        count: sql<number>`count(*)`,
      })
      .from(incident)
      .where(
        and(
          eq(incident.appId, input.appId),
          eq(incident.sourceType, input.sourceType),
          eq(incident.status, "open"),
          inArray(incident.sourceId, input.sourceIds),
        ),
      )
      .groupBy(incident.sourceId);

    return new Map(rows.map((row) => [row.sourceId, Number(row.count)]));
  } catch (error) {
    recordError(error);
    logger.error("Failed to load incident counts", error as Error);
    throw error;
  }
};

export { createGetOpenIncidentCountBySourceIds };
