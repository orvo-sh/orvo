import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getAppInputSchema } from "../schema";

const createGetApp = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof getAppInputSchema>,
  context: { organizationId: string },
) => {
  const validated = getAppInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const currentApp = await db.query.app.findFirst({
      where: and(
        eq(app.id, validated.data.id),
        eq(app.organizationId, context.organizationId),
      ),
    });

    if (!currentApp) {
      return err("App not found.");
    }

    return ok({ app: currentApp });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load app", error as Error);
    return err("Failed to load app.");
  }
};

export { createGetApp };
