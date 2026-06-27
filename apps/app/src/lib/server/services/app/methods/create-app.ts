import { recordError } from "$lib/instrumentation";
import type { AlertRuleService } from "$lib/server/services/alert-rule";
import type { IngestionKeyService } from "$lib/server/services/ingestion-key";
import type { DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createAppInputSchema } from "../schema";

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
    const id = genId("app");

    await db.transaction(async (tx) => {
      await tx.insert(app).values({
        id,
        organizationId: context.organizationId,
        name: validated.data.name,
        createdBy: context.userId,
        updatedBy: context.userId,
      });

      const results = await Promise.all([
        ingestionKeyService.createIngestionKey(
          { kind: "public" },
          { appId: id, userId: context.userId },
          tx,
        ),
        ingestionKeyService.createIngestionKey(
          { kind: "private" },
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
    });

    return ok({ id });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create app", error as Error);
    return err("Failed to create app.");
  }
};

export { createCreateApp };
