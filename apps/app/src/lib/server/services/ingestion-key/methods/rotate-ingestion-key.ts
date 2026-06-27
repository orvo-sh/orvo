import { recordError } from "$lib/instrumentation";
import { and, eq, isNull, type DB } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { rotateIngestionKeyInputSchema } from "../schema";

const createRotateIngestionKey = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof rotateIngestionKeyInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = rotateIngestionKeyInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const activeKey = await db.query.ingestionKey.findFirst({
      where: and(
        eq(ingestionKey.appId, context.appId),
        eq(ingestionKey.kind, validated.data.kind),
        isNull(ingestionKey.revokedAt),
      ),
    });

    if (activeKey) {
      await db
        .update(ingestionKey)
        .set({ revokedAt: new Date() })
        .where(eq(ingestionKey.id, activeKey.id))
        .execute();
    }

    const key = genId(validated.data.kind === "public" ? "pk" : "sk");
    const id = genId("ingk");

    await db
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
    logger.error("Failed to rotate ingestion key", error as Error);
    return err("Failed to rotate ingestion key.");
  }
};

export { createRotateIngestionKey };
