import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { ne } from "drizzle-orm";
import { z } from "zod";

import { updateAppInputSchema } from "../schema";
import { isAppNameConflict } from "./shared";

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
    const existingApp = await db.query.app.findFirst({
      columns: { id: true },
      where: and(
        eq(app.organizationId, context.organizationId),
        eq(app.name, validated.data.name),
        ne(app.id, validated.data.id),
      ),
    });
    if (existingApp) {
      return err("An app with this name already exists.");
    }

    const [updatedApp] = await db
      .update(app)
      .set({
        name: validated.data.name,
        ...(validated.data.logo !== undefined
          ? { logo: validated.data.logo }
          : {}),
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
    if (isAppNameConflict(error)) {
      return err("An app with this name already exists.");
    }

    recordError(error);
    logger.error("Failed to update app", error as Error);
    return err("Failed to update app.");
  }
};

export { createUpdateApp };
