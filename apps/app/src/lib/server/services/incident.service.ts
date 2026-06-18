import type { DB } from "@repo/db";
import { alertIncident, alertRule } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

class IncidentService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("IncidentService");
  }

  async getOpenIncidents(
    _input: z.infer<typeof getOpenIncidentsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getOpenIncidents: getting open incidents", { context });

    const validated = getOpenIncidentsInputSchema.safeParse(_input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const rows = await this.db
        .select({
          incident: alertIncident,
          rule: {
            id: alertRule.id,
            name: alertRule.name,
            signalType: alertRule.signalType,
            comparator: alertRule.comparator,
            threshold: alertRule.threshold,
            windowMinutes: alertRule.windowMinutes,
          },
        })
        .from(alertIncident)
        .innerJoin(alertRule, eq(alertIncident.ruleId, alertRule.id))
        .where(
          and(
            eq(alertIncident.appId, context.appId),
            eq(alertIncident.status, "open"),
          ),
        )
        .orderBy(desc(alertIncident.openedAt));

      return ok({
        incidents: rows.map(({ incident, rule }) => ({
          ...incident,
          rule,
        })),
      });
    } catch (error) {
      this.logger.error(
        "getOpenIncidents: failed to get open incidents",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to get open incidents.");
    }
  }
}

const getOpenIncidentsInputSchema = z.object({});

export { IncidentService, getOpenIncidentsInputSchema };
