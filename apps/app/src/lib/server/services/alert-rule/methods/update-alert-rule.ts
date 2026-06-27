import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule, alertRuleDestination, notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { updateAlertRuleInputSchema } from "../schema";
import { uniqueValues, validateRuleConfig } from "../shared";

const createUpdateAlertRule = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof updateAlertRuleInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = updateAlertRuleInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  const ruleValidationError = validateRuleConfig(validated.data);
  if (ruleValidationError) {
    return err(ruleValidationError);
  }

  try {
    const existing = await db.query.alertRule.findFirst({
      where: and(
        eq(alertRule.id, validated.data.id),
        eq(alertRule.appId, context.appId),
      ),
    });

    if (!existing) {
      return err("Alert rule not found.");
    }

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

    await db.transaction(async (tx) => {
      await tx
        .update(alertRule)
        .set({
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
          scopeHostNamesInclude: validated.data.scope.hostNames.include,
          scopeHostNamesExclude: validated.data.scope.hostNames.exclude,
          scopeContainerNamesInclude: validated.data.scope.containerNames.include,
          scopeContainerNamesExclude: validated.data.scope.containerNames.exclude,
          updatedBy: context.userId,
          nextEvaluationAt: new Date(),
          evaluationLeaseToken: null,
          evaluationLeaseExpiresAt: null,
        })
        .where(eq(alertRule.id, existing.id));

      await tx
        .delete(alertRuleDestination)
        .where(eq(alertRuleDestination.ruleId, existing.id));

      if (destinationIds.length > 0) {
        await tx.insert(alertRuleDestination).values(
          destinationIds.map((destinationId) => ({
            ruleId: existing.id,
            destinationId,
          })),
        );
      }
    });

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to update alert rule", error as Error);
    return err("Failed to update alert rule.");
  }
};

export { createUpdateAlertRule };
