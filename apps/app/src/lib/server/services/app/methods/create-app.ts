import { recordError } from "$lib/instrumentation";
import type { AlertRuleService } from "$lib/server/services/alert-rule";
import type { IngestionKeyService } from "$lib/server/services/ingestion-key";
import { and, eq, type DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createAppInputSchema } from "../schema";
import { isAppNameConflict } from "./shared";

const createCreateApp = ({
  db,
  logger,
  ingestionKeyService,
  alertRuleService,
}: {
  db: DB;
  logger: Logger;
  ingestionKeyService: IngestionKeyService;
  alertRuleService: AlertRuleService;
}) => async (
  input: z.input<typeof createAppInputSchema>,
  context: { organizationId: string; userId: string },
) => {
  const validated = createAppInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existingApp = await db.query.app.findFirst({
      columns: { id: true },
      where: and(
        eq(app.organizationId, context.organizationId),
        eq(app.name, validated.data.name),
      ),
    });
    if (existingApp) {
      return err("An app with this name already exists.");
    }

    const id = genId("app");

    const created = await db.transaction(async (tx) => {
      const [createdApp] = await tx
        .insert(app)
        .values({
          id,
          organizationId: context.organizationId,
          name: validated.data.name,
          logo: validated.data.logo,
          createdBy: context.userId,
          updatedBy: context.userId,
        })
        .onConflictDoNothing({ target: [app.organizationId, app.name] })
        .returning({ id: app.id });

      if (!createdApp) {
        return false;
      }

      const results = await Promise.all([
        ingestionKeyService.createIngestionKey(
          { name: "Default key" },
          { appId: id, userId: context.userId },
          tx,
        ),
        alertRuleService.seedDefaultAlertRules(
          { appId: id, userId: context.userId },
          tx,
        ),
      ]);

      for (const result of results) {
        if (!result.success) {
          throw new Error(result.error);
        }
      }

      return true;
    });

    if (!created) {
      return err("An app with this name already exists.");
    }

    return ok({ id });
  } catch (error) {
    if (isAppNameConflict(error)) {
      return err("An app with this name already exists.");
    }

    recordError(error);
    logger.error("Failed to create app", error as Error);
    return err("Failed to create app.");
  }
};

export { createCreateApp };
