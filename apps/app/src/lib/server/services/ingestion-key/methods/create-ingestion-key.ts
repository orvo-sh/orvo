import { recordError } from "$lib/instrumentation";
import { type DB, type Tx } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, generateRandomString, ok } from "@repo/utils";
import { z } from "zod";

import { createIngestionKeyInputSchema } from "../schema";

const createCreateIngestionKey = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof createIngestionKeyInputSchema>,
  context: { appId: string; userId: string },
  tx?: Tx,
) => {
  const validated = createIngestionKeyInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const currentDb = tx ?? db;
    const key = `ing_${generateRandomString(48)}`;
    const id = genId("ingk");

    await currentDb
      .insert(ingestionKey)
      .values({
        id,
        appId: context.appId,
        name: validated.data.name,
        key,
        createdBy: context.userId,
      })
      .execute();

    return ok({ id, key, name: validated.data.name });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create ingestion key", error as Error);
    return err("Failed to create ingestion key.");
  }
};

export { createCreateIngestionKey };
