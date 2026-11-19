import type { MetricAggregation } from "$lib/metric-definitions";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import {
  alertRule,
  alertRuleDestination,
  app,
  incident,
  notificationDelivery,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, asc, desc, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { IncidentService } from "../services/incident";

import { queryMetric } from "../services/metrics/metric-query";
import { BaseWorker } from "./base-worker";

const evaluationIntervalMs = 60_000;
const leaseDurationMs = 60_000;
const maxRulesPerCycle = 25;

class ThresholdAlertWorker extends BaseWorker {
  name = "threshold-alerts";
  cron = "* * * * *";

  constructor(
    logger: Logger,
    private db: DB,
    private clickhouse: ClickHouse,
    private incidentService: IncidentService,
    private config: { appBaseUrl: string },
  ) {
    super(logger, "ThresholdAlertWorker");
  }

  protected async run() {
    await this.processDueRules();
  }

  private async processDueRules() {
    const now = new Date();
    const dueRules = await this.db.query.alertRule.findMany({
      where: and(
        eq(alertRule.isEnabled, true),
        lte(alertRule.nextEvaluationAt, now),
      ),
      orderBy: [asc(alertRule.nextEvaluationAt)],
      limit: maxRulesPerCycle,
    });

    for (const rule of dueRules) {
      const claimed = await this.claimRule(rule.id);
      if (!claimed) {
        continue;
      }

      try {
        await this.evaluateRule(claimed);
      } catch (error) {
        this.logger.error(
          `ThresholdAlertWorker: failed to evaluate rule ${rule.id}`,
          error instanceof Error ? error : undefined,
        );
        await this.releaseRule(rule.id);
      }
    }
  }

  private async claimRule(ruleId: string) {
    const now = new Date();
    const leaseToken = genId("alse");
    const rows = await this.db
      .update(alertRule)
      .set({
        evaluationLeaseToken: leaseToken,
        evaluationLeaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      })
      .where(
        and(
          eq(alertRule.id, ruleId),
          eq(alertRule.isEnabled, true),
          lte(alertRule.nextEvaluationAt, now),
          or(
            isNull(alertRule.evaluationLeaseExpiresAt),
            lt(alertRule.evaluationLeaseExpiresAt, now),
          ),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  private async releaseRule(ruleId: string) {
    await this.db
      .update(alertRule)
      .set({
        nextEvaluationAt: new Date(Date.now() + evaluationIntervalMs),
        lastEvaluatedAt: new Date(),
        evaluationLeaseToken: null,
        evaluationLeaseExpiresAt: null,
      })
      .where(eq(alertRule.id, ruleId));
  }

  private async evaluateRule(rule: typeof alertRule.$inferSelect) {
    const windowEndAt = new Date(
      Math.floor(Date.now() / evaluationIntervalMs) * evaluationIntervalMs,
    );
    const windowStartAt = new Date(
      windowEndAt.getTime() - rule.windowMinutes * 60_000,
    );
    const [signals, openIncidents, destinations, currentApp] =
      await Promise.all([
        this.queryRuleSignals(rule, windowStartAt, windowEndAt),
        this.db.query.incident.findMany({
          where: and(
            eq(incident.appId, rule.appId),
            eq(incident.sourceType, "alert"),
            eq(incident.sourceId, rule.id),
            eq(incident.status, "open"),
          ),
          orderBy: [desc(incident.openedAt)],
        }),
        this.db.query.alertRuleDestination.findMany({
          where: eq(alertRuleDestination.ruleId, rule.id),
        }),
        this.db.query.app.findFirst({
          where: eq(app.id, rule.appId),
        }),
      ]);
    await this.db
      .update(alertRule)
      .set({
        lastEvaluationStatus: signals.some((signal) => signal.status === "ok")
          ? "ok"
          : "no_data",
      })
      .where(eq(alertRule.id, rule.id));
    const openIncidentByEntityKey = new Map(
      openIncidents.map((incident) => [
        buildEntityKey(incident.entityType, incident.entityId),
        incident,
      ]),
    );
    let didMutate = false;

    for (const signal of signals) {
      const entityKey = buildEntityKey(signal.entityType, signal.entityId);
      const openIncident = openIncidentByEntityKey.get(entityKey) ?? null;

      if (signal.status === "no_data") {
        continue;
      }

      const shouldTrigger = compareValues(
        signal.value,
        rule.comparator,
        rule.threshold,
      );

      if (shouldTrigger && !openIncident) {
        await this.openIncident(
          rule,
          signal,
          windowStartAt,
          windowEndAt,
          destinations,
          currentApp?.name ?? "Orvo app",
        );
        didMutate = true;
        continue;
      }

      if (shouldTrigger && openIncident) {
        await this.renotifyIncident(
          rule,
          openIncident,
          signal.value,
          windowStartAt,
          windowEndAt,
          destinations,
          currentApp?.name ?? "Orvo app",
        );
        didMutate = true;
        continue;
      }

      if (!shouldTrigger && openIncident) {
        await this.resolveIncident(
          rule,
          openIncident,
          signal.value,
          windowStartAt,
          windowEndAt,
          destinations,
          currentApp?.name ?? "Orvo app",
        );
        didMutate = true;
      }
    }

    if (!didMutate) {
      await this.finishRuleEvaluation(rule.id);
    }
  }

  private async openIncident(
    rule: typeof alertRule.$inferSelect,
    signal: EvaluatedSignal & { status: "ok"; value: number },
    windowStartAt: Date,
    windowEndAt: Date,
    destinations: Array<typeof alertRuleDestination.$inferSelect>,
    appName: string,
  ) {
    const now = new Date();

    await this.db.transaction(async (tx) => {
      const openedIncident = await this.incidentService.openOrGetIncident(
        {
          appId: rule.appId,
          sourceType: "alert",
          sourceId: rule.id,
          sourceKey: buildAlertSourceKey(
            rule.id,
            signal.entityType,
            signal.entityId,
          ),
          type: "alert_threshold",
          title: rule.name,
          severity: "critical",
          serviceName:
            rule.scopeServicesInclude.length === 1
              ? rule.scopeServicesInclude[0]
              : null,
          entityType: signal.entityType,
          entityId: signal.entityId,
          entityName: signal.entityName,
          sourceSnapshot: buildAlertIncidentSnapshot(
            rule,
            appName,
            signal.entityType,
            signal.entityId,
            signal.entityName,
          ),
          triggerEventType: "alert.fired",
          now,
          lastObservedAt: windowEndAt,
          lastObservedValue: signal.value,
          lastNotifiedAt: destinations.length > 0 ? now : null,
          openMetadata: buildAlertEventMetadata(
            windowStartAt,
            windowEndAt,
            signal.value,
          ),
          triggerMetadata: buildAlertEventMetadata(
            windowStartAt,
            windowEndAt,
            signal.value,
          ),
        },
        tx,
      );

      await tx
        .update(alertRule)
        .set({
          lastTriggeredAt: now,
          lastEvaluatedAt: now,
          nextEvaluationAt: new Date(now.getTime() + evaluationIntervalMs),
          evaluationLeaseToken: null,
          evaluationLeaseExpiresAt: null,
        })
        .where(eq(alertRule.id, rule.id));

      if (openedIncident.opened && destinations.length > 0) {
        await tx
          .insert(notificationDelivery)
          .values(
            buildDeliveryRows(
              "alert.opened",
              rule,
              appName,
              this.config.appBaseUrl,
              openedIncident.incident.id,
              signal.entityType,
              signal.entityId,
              signal.entityName,
              signal.value,
              windowStartAt,
              windowEndAt,
              destinations,
              now,
            ),
          );
      }
    });
  }

  private async renotifyIncident(
    rule: typeof alertRule.$inferSelect,
    incident: SharedIncidentRow,
    value: number | null,
    windowStartAt: Date,
    windowEndAt: Date,
    destinations: Array<typeof alertRuleDestination.$inferSelect>,
    appName: string,
  ) {
    const now = new Date();
    const shouldRenotify =
      rule.renotifyMinutes &&
      (!incident.lastNotifiedAt ||
        now.getTime() - incident.lastNotifiedAt.getTime() >=
          rule.renotifyMinutes * 60_000);

    await this.db.transaction(async (tx) => {
      await this.incidentService.touchIncident(
        {
          id: incident.id,
          appId: incident.appId,
          lastObservedAt: windowEndAt,
          lastObservedValue: value,
          lastNotifiedAt: shouldRenotify ? now : incident.lastNotifiedAt,
          renotifyCount: shouldRenotify
            ? incident.renotifyCount + 1
            : incident.renotifyCount,
          eventType: shouldRenotify ? "alert.fired" : undefined,
          eventMetadata: shouldRenotify
            ? buildAlertEventMetadata(windowStartAt, windowEndAt, value)
            : undefined,
        },
        tx,
      );

      await tx
        .update(alertRule)
        .set({
          lastTriggeredAt: now,
          lastEvaluatedAt: now,
          nextEvaluationAt: new Date(now.getTime() + evaluationIntervalMs),
          evaluationLeaseToken: null,
          evaluationLeaseExpiresAt: null,
        })
        .where(eq(alertRule.id, rule.id));

      if (shouldRenotify && destinations.length > 0) {
        await tx
          .insert(notificationDelivery)
          .values(
            buildDeliveryRows(
              "alert.renotified",
              rule,
              appName,
              this.config.appBaseUrl,
              incident.id,
              incident.entityType,
              incident.entityId,
              incident.entityName,
              value,
              windowStartAt,
              windowEndAt,
              destinations,
              now,
            ),
          );
      }
    });
  }

  private async resolveIncident(
    rule: typeof alertRule.$inferSelect,
    incident: SharedIncidentRow,
    value: number | null,
    windowStartAt: Date,
    windowEndAt: Date,
    destinations: Array<typeof alertRuleDestination.$inferSelect>,
    appName: string,
  ) {
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await this.incidentService.resolveOpenIncidentBySourceKey(
        {
          appId: rule.appId,
          sourceKey: incident.sourceKey,
          now,
          metadata: buildAlertEventMetadata(windowStartAt, windowEndAt, value),
          lastObservedValue: value,
        },
        tx,
      );

      await tx
        .update(alertRule)
        .set({
          lastResolvedAt: now,
          lastEvaluatedAt: now,
          nextEvaluationAt: new Date(now.getTime() + evaluationIntervalMs),
          evaluationLeaseToken: null,
          evaluationLeaseExpiresAt: null,
        })
        .where(eq(alertRule.id, rule.id));

      if (destinations.length > 0) {
        await tx
          .insert(notificationDelivery)
          .values(
            buildDeliveryRows(
              "alert.resolved",
              rule,
              appName,
              this.config.appBaseUrl,
              incident.id,
              incident.entityType,
              incident.entityId,
              incident.entityName,
              value,
              windowStartAt,
              windowEndAt,
              destinations,
              now,
            ),
          );
      }
    });
  }

  private async finishRuleEvaluation(ruleId: string) {
    await this.db
      .update(alertRule)
      .set({
        lastEvaluatedAt: new Date(),
        nextEvaluationAt: new Date(Date.now() + evaluationIntervalMs),
        evaluationLeaseToken: null,
        evaluationLeaseExpiresAt: null,
      })
      .where(eq(alertRule.id, ruleId));
  }

  private async queryRuleSignals(
    rule: typeof alertRule.$inferSelect,
    windowStartAt: Date,
    windowEndAt: Date,
  ): Promise<EvaluatedSignal[]> {
    const metric = rule;
    if (!metric.metricName || !metric.metricAggregation) return [];
    const containers = metric.metricName === "container.cpu.utilization";
    const rows = await queryMetric(this.clickhouse, {
      appId: rule.appId,
      name: metric.metricName,
      aggregation: metric.metricAggregation as MetricAggregation,
      start: windowStartAt,
      end: windowEndAt,
      groupBy: containers ? "container" : "none",
      scope: {
        services: {
          include: rule.scopeServicesInclude,
          exclude: rule.scopeServicesExclude,
        },
        environments: {
          include: rule.scopeEnvironmentsInclude,
          exclude: rule.scopeEnvironmentsExclude,
        },
        scopes: {
          include: rule.scopeScopesInclude,
          exclude: rule.scopeScopesExclude,
        },
        spanNames: {
          include: rule.scopeSpanNamesInclude,
          exclude: rule.scopeSpanNamesExclude,
        },
        containerNames: {
          include: rule.scopeContainerNamesInclude,
          exclude: rule.scopeContainerNamesExclude,
        },
      },
      attributes: rule.metricAttributeFilters,
    });
    if (!rows.length)
      return [
        {
          entityType: "app",
          entityId: rule.appId,
          entityName: null,
          status: "no_data",
        },
      ];
    return rows.map((row) => ({
      entityType: containers ? ("container" as const) : ("app" as const),
      entityId: containers ? row.group_key : rule.appId,
      entityName: containers ? row.group_key : null,
      status: row.value === null ? ("no_data" as const) : ("ok" as const),
      value: row.value ?? 0,
    }));
  }
}

type AlertRuleRow = typeof alertRule.$inferSelect;
type SharedIncidentRow = typeof incident.$inferSelect;
type AlertRuleDestinationRow = typeof alertRuleDestination.$inferSelect;
type AlertEventName = "alert.opened" | "alert.renotified" | "alert.resolved";
type AlertEntityType = SharedIncidentRow["entityType"];
type EvaluatedSignal =
  | {
      entityType: AlertEntityType;
      entityId: string;
      entityName: string | null;
      status: "ok";
      value: number;
    }
  | {
      entityType: AlertEntityType;
      entityId: string;
      entityName: string | null;
      status: "no_data";
    };

const compareValues = (
  value: number,
  comparator: "gt" | "gte" | "lt" | "lte",
  threshold: number,
) => {
  switch (comparator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
  }
};

const buildPayload = (
  eventType: AlertEventName,
  rule: AlertRuleRow,
  appName: string,
  appBaseUrl: string,
  incidentId: string,
  entityType: AlertEntityType,
  entityId: string,
  entityName: string | null,
  value: number | null,
  windowStartAt: Date,
  windowEndAt: Date,
) => ({
  type: eventType,
  timestamp: new Date().toISOString(),
  app: {
    id: rule.appId,
    name: appName,
  },
  rule: {
    id: rule.id,
    name: rule.name,

    metricName: rule.metricName,
    metricAggregation: rule.metricAggregation,
    metricUnit: rule.metricUnit,
    comparator: rule.comparator,
    threshold: rule.threshold,
    windowMinutes: rule.windowMinutes,
  },
  incident: {
    id: incidentId,
    url: buildIncidentUrl(appBaseUrl, rule.appId, incidentId),
    entity: {
      type: entityType,
      id: entityId,
      name: entityName,
    },
  },
  evaluation: {
    windowStartAt: windowStartAt.toISOString(),
    windowEndAt: windowEndAt.toISOString(),
    observedValue: value,
  },
});

const buildDeliveryRows = (
  eventType: AlertEventName,
  rule: AlertRuleRow,
  appName: string,
  appBaseUrl: string,
  incidentId: string,
  entityType: AlertEntityType,
  entityId: string,
  entityName: string | null,
  value: number | null,
  windowStartAt: Date,
  windowEndAt: Date,
  destinations: AlertRuleDestinationRow[],
  now: Date,
) =>
  destinations.map((destination) => ({
    id: genId("ntdl"),
    appId: rule.appId,
    destinationId: destination.destinationId,
    incidentId,
    sourceKind: "alert" as const,
    sourceId: rule.id,
    eventType,
    payload: buildPayload(
      eventType,
      rule,
      appName,
      appBaseUrl,
      incidentId,
      entityType,
      entityId,
      entityName,
      value,
      windowStartAt,
      windowEndAt,
    ),
    status: "pending" as const,
    nextAttemptAt: now,
  }));

const buildEntityKey = (entityType: AlertEntityType, entityId: string) =>
  `${entityType}:${entityId}`;
const buildAlertSourceKey = (
  ruleId: string,
  entityType: AlertEntityType,
  entityId: string,
) => `alert:${ruleId}:${entityType}:${entityId}`;
const buildIncidentUrl = (
  appBaseUrl: string,
  appId: string,
  incidentId: string,
) =>
  new URL(
    `/a/${encodeURIComponent(appId)}/incidents/${encodeURIComponent(incidentId)}`,
    appBaseUrl,
  ).toString();

const buildAlertIncidentSnapshot = (
  rule: AlertRuleRow,
  appName: string,
  entityType: AlertEntityType,
  entityId: string,
  entityName: string | null,
) => ({
  appName,
  ruleId: rule.id,
  ruleName: rule.name,

  comparator: rule.comparator,
  threshold: rule.threshold,
  windowMinutes: rule.windowMinutes,
  renotifyMinutes: rule.renotifyMinutes,
  entityType,
  entityId,
  entityName,
});

const buildAlertEventMetadata = (
  windowStartAt: Date,
  windowEndAt: Date,
  value: number | null,
) => ({
  windowStartAt: windowStartAt.toISOString(),
  windowEndAt: windowEndAt.toISOString(),
  observedValue: value,
});

export { ThresholdAlertWorker };
