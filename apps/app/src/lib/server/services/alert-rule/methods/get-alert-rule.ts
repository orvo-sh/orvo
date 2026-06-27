import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule, alertRuleDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAlertRuleInputSchema } from "../schema";

const createGetAlertRule = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof getAlertRuleInputSchema>,
  context: { appId: string },
) => {
  const validated = getAlertRuleInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const rule = await db.query.alertRule.findFirst({
      where: and(
        eq(alertRule.id, validated.data),
        eq(alertRule.appId, context.appId),
      ),
    });

    if (!rule) {
      return err("Alert rule not found.");
    }

    const destinations = await db.query.alertRuleDestination.findMany({
      where: eq(alertRuleDestination.ruleId, rule.id),
      orderBy: [asc(alertRuleDestination.destinationId)],
    });

    return ok({
      rule: {
        ...rule,
        destinationIds: destinations.map((destination) => destination.destinationId),
      },
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to get alert rule", error as Error);
    return err("Failed to get alert rule.");
  }
};

export { createGetAlertRule };
