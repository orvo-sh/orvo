import { recordError } from "$lib/instrumentation";
import { and, eq, isNull, type DB, type Tx } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
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

    const activeKey = await currentDb.query.ingestionKey.findFirst({
      where: and(
        eq(ingestionKey.appId, context.appId),
        eq(ingestionKey.kind, validated.data.kind),
        isNull(ingestionKey.revokedAt),
      ),
    });

    if (activeKey) {
      return ok({ id: activeKey.id, key: activeKey.key });
    }

    const key = genId(validated.data.kind === "public" ? "pk" : "sk");
    const id = genId("ingk");

    await currentDb
      .insert(ingestionKey)
      .values({
        id,
        appId: context.appId,
        kind: validated.data.kind,
        key,
        createdBy: context.userId,
      })
      .execute();

    return ok({ id, key });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create ingestion key", error as Error);
    return err("Failed to create ingestion key.");
  }
};

export { createCreateIngestionKey };
