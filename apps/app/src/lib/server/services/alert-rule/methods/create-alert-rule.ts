import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule, alertRuleDestination, notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createAlertRuleInputSchema } from "../schema";
import { uniqueValues, validateRuleConfig } from "../shared";

const createCreateAlertRule = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof createAlertRuleInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = createAlertRuleInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  const ruleValidationError = validateRuleConfig(validated.data);
  if (ruleValidationError) {
    return err(ruleValidationError);
  }

  try {
    const destinationIds = uniqueValues(validated.data.destinationIds);
    const destinations =
      destinationIds.length === 0
        ? []
        : await db.query.notificationDestination.findMany({
            where: and(
              eq(notificationDestination.appId, context.appId),
              inArray(notificationDestination.id, destinationIds),
            ),
            orderBy: [asc(notificationDestination.name)],
          });

    if (destinations.length !== destinationIds.length) {
      return err("One or more notification destinations could not be found.");
    }

    const id = genId("alrt");

    await db.transaction(async (tx) => {
      await tx.insert(alertRule).values({
        id,
        appId: context.appId,
        name: validated.data.name,
        signalType: validated.data.signalType,
        comparator: validated.data.comparator,
        threshold: validated.data.threshold,
        windowMinutes: validated.data.windowMinutes,
        renotifyMinutes: validated.data.renotifyMinutes,
        apdexTargetMs: validated.data.apdexTargetMs,
        scopeServicesInclude: validated.data.scope.services.include,
        scopeServicesExclude: validated.data.scope.services.exclude,
        scopeSpanNamesInclude: validated.data.scope.spanNames.include,
        scopeSpanNamesExclude: validated.data.scope.spanNames.exclude,
        scopeEnvironmentsInclude: validated.data.scope.environments.include,
        scopeEnvironmentsExclude: validated.data.scope.environments.exclude,
        scopeScopesInclude: validated.data.scope.scopes.include,
        scopeScopesExclude: validated.data.scope.scopes.exclude,
        scopeContainerNamesInclude: validated.data.scope.containerNames.include,
        scopeContainerNamesExclude: validated.data.scope.containerNames.exclude,
        createdBy: context.userId,
        updatedBy: context.userId,
      });

      if (destinationIds.length > 0) {
        await tx.insert(alertRuleDestination).values(
          destinationIds.map((destinationId) => ({
            ruleId: id,
            destinationId,
          })),
        );
      }
    });

    return ok({ id });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create alert rule", error as Error);
    return err("Failed to create alert rule.");
  }
};

export { createCreateAlertRule };
