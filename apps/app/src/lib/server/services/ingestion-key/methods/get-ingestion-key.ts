import { recordError } from "$lib/instrumentation";
import { and, desc, eq, isNull, type DB } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getIngestionKeyInputSchema } from "../schema";

const createGetIngestionKey = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof getIngestionKeyInputSchema>,
  context: { appId: string },
) => {
  const validated = getIngestionKeyInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const key = await db.query.ingestionKey.findFirst({
      where: validated.data.id
        ? and(
            eq(ingestionKey.id, validated.data.id),
            eq(ingestionKey.appId, context.appId),
            isNull(ingestionKey.revokedAt),
          )
        : and(eq(ingestionKey.appId, context.appId), isNull(ingestionKey.revokedAt)),
      orderBy: [desc(ingestionKey.createdAt)],
    });

    return ok({ key: key ?? null });
  } catch (error) {
    recordError(error);
    logger.error("Failed to get ingestion key", error as Error);
    return err("Failed to get ingestion key.");
  }
};

export { createGetIngestionKey };
