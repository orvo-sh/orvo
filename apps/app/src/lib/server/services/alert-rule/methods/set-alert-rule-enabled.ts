import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule, incident, incidentEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { setAlertRuleEnabledInputSchema } from "../schema";

const createSetAlertRuleEnabled = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof setAlertRuleEnabledInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = setAlertRuleEnabledInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
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

    await db.transaction(async (tx) => {
      await tx
        .update(alertRule)
        .set({
          isEnabled: validated.data.isEnabled,
          updatedBy: context.userId,
          nextEvaluationAt: new Date(),
          evaluationLeaseToken: null,
          evaluationLeaseExpiresAt: null,
        })
        .where(eq(alertRule.id, existing.id));

      if (!validated.data.isEnabled) {
        const now = new Date();
        const openIncidents = await tx.query.incident.findMany({
          where: and(
            eq(incident.appId, context.appId),
            eq(incident.sourceType, "alert"),
            eq(incident.sourceId, existing.id),
            eq(incident.status, "open"),
          ),
        });

        if (openIncidents.length > 0) {
          await tx
            .update(incident)
            .set({
              status: "resolved",
              resolvedAt: now,
              lastObservedAt: now,
            })
            .where(
              and(
                eq(incident.appId, context.appId),
                eq(incident.sourceType, "alert"),
                eq(incident.sourceId, existing.id),
                eq(incident.status, "open"),
              ),
            );

          await tx.insert(incidentEvent).values(
            openIncidents.map((openIncident) => ({
              id: genId("inev"),
              appId: context.appId,
              incidentId: openIncident.id,
              eventType: "incident.resolved" as const,
              occurredAt: now,
              actorUserId: context.userId,
              metadata: {
                reason: "alert_rule_disabled",
              },
            })),
          );
        }
      }
    });

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to update alert rule", error as Error);
    return err("Failed to update alert rule.");
  }
};

export { createSetAlertRuleEnabled };
