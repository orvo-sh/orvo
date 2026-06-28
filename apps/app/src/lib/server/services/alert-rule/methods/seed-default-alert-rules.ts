import { recordError } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import { alertRule } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { eq } from "drizzle-orm";

import { defaultAlertRules } from "../shared";

const createSeedDefaultAlertRules = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  context: { appId: string; userId: string },
  tx?: Tx,
) => {
  try {
    const database = tx ?? db;

    const existingRule = await database.query.alertRule.findFirst({
      where: eq(alertRule.appId, context.appId),
    });

    if (existingRule) {
      return ok(undefined);
    }

    await database.insert(alertRule).values(
      defaultAlertRules.map((rule) => ({
        id: genId("alrt"),
        appId: context.appId,
        name: rule.name,
        signalType: rule.signalType,
        comparator: rule.comparator,
        threshold: rule.threshold,
        windowMinutes: rule.windowMinutes,
        renotifyMinutes: rule.renotifyMinutes,
        apdexTargetMs: rule.apdexTargetMs,
        scopeServicesInclude: [],
        scopeServicesExclude: [],
        scopeSpanNamesInclude: [],
        scopeSpanNamesExclude: [],
        scopeEnvironmentsInclude: [],
        scopeEnvironmentsExclude: [],
        scopeScopesInclude: [],
        scopeScopesExclude: [],
        scopeContainerNamesInclude: [],
        scopeContainerNamesExclude: [],
        createdBy: context.userId,
        updatedBy: context.userId,
      })),
    );

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to seed default alert rules", error as Error);
    return err("Failed to seed default alert rules.");
  }
};

export { createSeedDefaultAlertRules };
