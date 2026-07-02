import { recordError } from "$lib/instrumentation";
import { and, desc, eq, isNull, type DB } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { listIngestionKeysInputSchema } from "../schema";

const createListIngestionKeys = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof listIngestionKeysInputSchema>,
  context: { appId: string },
) => {
  const validated = listIngestionKeysInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const keys = await db.query.ingestionKey.findMany({
      where: validated.data.includeRevoked
        ? eq(ingestionKey.appId, context.appId)
        : and(eq(ingestionKey.appId, context.appId), isNull(ingestionKey.revokedAt)),
      orderBy: [desc(ingestionKey.createdAt)],
    });

    return ok({ keys });
  } catch (error) {
    recordError(error);
    logger.error("Failed to list ingestion keys", error as Error);
    return err("Failed to list ingestion keys.");
  }
};

export { createListIngestionKeys };
