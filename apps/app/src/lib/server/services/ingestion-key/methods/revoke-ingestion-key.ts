import { recordError } from "$lib/instrumentation";
import { and, eq, isNull, type DB } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { revokeIngestionKeyInputSchema } from "../schema";

const createRevokeIngestionKey = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof revokeIngestionKeyInputSchema>,
  context: { appId: string },
) => {
  const validated = revokeIngestionKeyInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const [revokedKey] = await db
      .update(ingestionKey)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(ingestionKey.id, validated.data.id),
          eq(ingestionKey.appId, context.appId),
          isNull(ingestionKey.revokedAt),
        ),
      )
      .returning();

    if (!revokedKey) {
      return err("Ingestion key not found.");
    }

    return ok({ id: revokedKey.id });
  } catch (error) {
    recordError(error);
    logger.error("Failed to revoke ingestion key", error as Error);
    return err("Failed to revoke ingestion key.");
  }
};

export { createRevokeIngestionKey };
