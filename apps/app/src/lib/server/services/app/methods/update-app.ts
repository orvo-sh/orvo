import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { updateAppInputSchema } from "../schema";

const createUpdateApp = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof updateAppInputSchema>,
  context: { organizationId: string; userId: string },
) => {
  const validated = updateAppInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const [updatedApp] = await db
      .update(app)
      .set({
        name: validated.data.name,
        updatedBy: context.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(app.id, validated.data.id),
          eq(app.organizationId, context.organizationId),
        ),
      )
      .returning();

    if (!updatedApp) {
      return err("App not found.");
    }

    return ok({ app: updatedApp });
  } catch (error) {
    recordError(error);
    logger.error("Failed to update app", error as Error);
    return err("Failed to update app.");
  }
};

export { createUpdateApp };
