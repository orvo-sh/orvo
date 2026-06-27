import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule, alertRuleDestination, incident } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq, inArray } from "drizzle-orm";

const createGetAlertRules = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (context: { appId: string }) => {
  try {
    const rules = await db.query.alertRule.findMany({
      where: eq(alertRule.appId, context.appId),
      orderBy: [desc(alertRule.updatedAt)],
    });

    if (rules.length === 0) {
      return ok({ rules: [] });
    }

    const ruleIds = rules.map((rule) => rule.id);
    const [ruleDestinations, openIncidents] = await Promise.all([
      db.query.alertRuleDestination.findMany({
        where: inArray(alertRuleDestination.ruleId, ruleIds),
      }),
      db.query.incident.findMany({
        where: and(
          eq(incident.appId, context.appId),
          eq(incident.sourceType, "alert"),
          eq(incident.status, "open"),
        ),
        orderBy: [desc(incident.openedAt)],
      }),
    ]);
    const destinationCountByRuleId = new Map<string, number>();
    const openIncidentByRuleId = new Map<string, (typeof openIncidents)[number]>();
    const openIncidentCountByRuleId = new Map<string, number>();

    for (const destination of ruleDestinations) {
      destinationCountByRuleId.set(
        destination.ruleId,
        (destinationCountByRuleId.get(destination.ruleId) ?? 0) + 1,
      );
    }

    for (const openIncident of openIncidents) {
      if (!openIncidentByRuleId.has(openIncident.sourceId)) {
        openIncidentByRuleId.set(openIncident.sourceId, openIncident);
      }

      openIncidentCountByRuleId.set(
        openIncident.sourceId,
        (openIncidentCountByRuleId.get(openIncident.sourceId) ?? 0) + 1,
      );
    }

    return ok({
      rules: rules.map((rule) => ({
        ...rule,
        destinationCount: destinationCountByRuleId.get(rule.id) ?? 0,
        openIncident: openIncidentByRuleId.get(rule.id) ?? null,
        openIncidentCount: openIncidentCountByRuleId.get(rule.id) ?? 0,
      })),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to get alert rules", error as Error);
    return err("Failed to get alert rules.");
  }
};

export { createGetAlertRules };
