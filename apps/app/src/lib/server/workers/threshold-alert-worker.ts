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

import { BaseWorker } from "./base-worker";

const evaluationIntervalMs = 60_000;
const leaseDurationMs = 60_000;
const maxRulesPerCycle = 25;
const traceMetricsMigrationVersion = "20260713000000_trace-metrics-rollup";

class ThresholdAlertWorker extends BaseWorker {
  name = "threshold-alerts";
  cron = "* * * * *";
  private traceMetricsAvailableFrom: Date | null | undefined;

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
      where: and(eq(alertRule.isEnabled, true), lte(alertRule.nextEvaluationAt, now)),
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
    const windowStartAt = new Date(windowEndAt.getTime() - rule.windowMinutes * 60_000);
    const [signals, openIncidents, destinations, currentApp] = await Promise.all([
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
    const openIncidentByEntityKey = new Map(
      openIncidents.map((incident) => [
        buildEntityKey(incident.entityType, incident.entityId),
        incident,
      ]),
    );
    const touchedEntityKeys = new Set<string>();
    let didMutate = false;

    for (const signal of signals) {
      const entityKey = buildEntityKey(signal.entityType, signal.entityId);
      const openIncident = openIncidentByEntityKey.get(entityKey) ?? null;

      touchedEntityKeys.add(entityKey);

      if (signal.status === "no_data") {
        continue;
      }

      const shouldTrigger = compareValues(signal.value, rule.comparator, rule.threshold);

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

    if (isEntityScopedSignal(rule.signalType)) {
      for (const incident of openIncidents) {
        if (touchedEntityKeys.has(buildEntityKey(incident.entityType, incident.entityId))) {
          continue;
        }

        await this.resolveIncident(
          rule,
          incident,
          null,
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
          openMetadata: buildAlertEventMetadata(windowStartAt, windowEndAt, signal.value),
          triggerMetadata: buildAlertEventMetadata(windowStartAt, windowEndAt, signal.value),
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
        await tx.insert(notificationDelivery).values(
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
        now.getTime() - incident.lastNotifiedAt.getTime() >= rule.renotifyMinutes * 60_000);

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
        await tx.insert(notificationDelivery).values(
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
        await tx.insert(notificationDelivery).values(
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
    if (isTraceSignal(rule.signalType)) {
      const useRollup =
        rule.signalType !== "apdex" &&
        (await this.canUseTraceMetricsRollup(windowStartAt));
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: useRollup
          ? buildTraceMetricsSignalQuery(rule, windowStartAt, windowEndAt)
          : buildRawTraceSignalQuery(rule, windowStartAt, windowEndAt),
      });
      const row = (
        (await result.json()) as unknown as Array<{
          total_count: number | string;
          error_count: number | string;
          p95_ms: number | string;
          p99_ms: number | string;
          satisfied_count: number | string;
          tolerated_count: number | string;
        }>
      )[0];
      const totalCount = Number(row?.total_count ?? 0);
      const errorCount = Number(row?.error_count ?? 0);
      const p95Ms = Number(row?.p95_ms ?? 0);
      const p99Ms = Number(row?.p99_ms ?? 0);
      const satisfiedCount = Number(row?.satisfied_count ?? 0);
      const toleratedCount = Number(row?.tolerated_count ?? 0);

      if (rule.signalType === "throughput_per_min") {
        return [
          {
            entityType: "app",
            entityId: rule.appId,
            entityName: null,
            status: "ok",
            value: totalCount / Math.max(rule.windowMinutes, 1),
          },
        ];
      }

      if (totalCount === 0) {
        return [
          {
            entityType: "app",
            entityId: rule.appId,
            entityName: null,
            status: "no_data",
          },
        ];
      }

      switch (rule.signalType) {
        case "error_rate":
          return [
            {
              entityType: "app",
              entityId: rule.appId,
              entityName: null,
              status: "ok",
              value: (errorCount / totalCount) * 100,
            },
          ];
        case "availability_percent":
          return [
            {
              entityType: "app",
              entityId: rule.appId,
              entityName: null,
              status: "ok",
              value: 100 - (errorCount / totalCount) * 100,
            },
          ];
        case "latency_p95_ms":
          return [
            {
              entityType: "app",
              entityId: rule.appId,
              entityName: null,
              status: "ok",
              value: p95Ms,
            },
          ];
        case "latency_p99_ms":
          return [
            {
              entityType: "app",
              entityId: rule.appId,
              entityName: null,
              status: "ok",
              value: p99Ms,
            },
          ];
        case "apdex":
          return [
            {
              entityType: "app",
              entityId: rule.appId,
              entityName: null,
              status: "ok",
              value: (satisfiedCount + toleratedCount / 2) / totalCount,
            },
          ];
      }

      throw new Error(`Unsupported trace alert signal: ${rule.signalType}`);
    }

    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: buildMetricSignalQuery(rule, windowStartAt, windowEndAt),
    });
    const rows = (await result.json()) as unknown as Array<{
      entity_id: string;
      entity_name: string | null;
      value: number | string | null;
    }>;

    return rows
      .map((row) => ({
        entityType: resolveEntityType(rule.signalType),
        entityId: row.entity_id,
        entityName: row.entity_name,
        status: "ok" as const,
        value: row.value === null ? null : Number(row.value),
      }))
      .filter(
        (row): row is EvaluatedSignal & { status: "ok"; value: number } =>
          row.entityId.length > 0 && row.value !== null && Number.isFinite(row.value),
      );
  }

  private async canUseTraceMetricsRollup(windowStartAt: Date) {
    if (this.traceMetricsAvailableFrom === undefined) {
      try {
        const result = await this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT toUnixTimestamp(applied_at) * 1000 AS applied_at_ms
            FROM schema_migrations
            WHERE version = ${quote(traceMetricsMigrationVersion)}
            ORDER BY applied_at DESC
            LIMIT 1
          `,
        });
        const row = (
          (await result.json()) as unknown as Array<{
            applied_at_ms: number | string;
          }>
        )[0];
        const appliedAtMs = Number(row?.applied_at_ms ?? 0);

        this.traceMetricsAvailableFrom = appliedAtMs
          ? new Date(
              Math.ceil(appliedAtMs / evaluationIntervalMs) * evaluationIntervalMs,
            )
          : null;
      } catch (error) {
        this.traceMetricsAvailableFrom = null;
        this.logger.warn(
          "ThresholdAlertWorker: trace metrics rollup unavailable; using raw traces",
          error,
        );
      }
    }

    return Boolean(
      this.traceMetricsAvailableFrom &&
        windowStartAt >= this.traceMetricsAvailableFrom,
    );
  }
}

type AlertRuleRow = typeof alertRule.$inferSelect;
type SharedIncidentRow = typeof incident.$inferSelect;
type AlertRuleDestinationRow = typeof alertRuleDestination.$inferSelect;
type AlertEventName = "alert.opened" | "alert.renotified" | "alert.resolved";
type AlertEntityType = SharedIncidentRow["entityType"];
type AlertSignalType = AlertRuleRow["signalType"];
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
    signalType: rule.signalType,
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
  signalType: rule.signalType,
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

const isTraceSignal = (signalType: AlertSignalType) =>
  [
    "error_rate",
    "latency_p95_ms",
    "latency_p99_ms",
    "apdex",
    "throughput_per_min",
    "availability_percent",
  ].includes(signalType);

const isEntityScopedSignal = (signalType: AlertSignalType) =>
  [
    "container_cpu_utilization",
    "container_memory_utilization",
    "container_reporting_stale",
  ].includes(signalType);

const resolveEntityType = (signalType: AlertSignalType): AlertEntityType =>
  signalType.startsWith("container_") ? "container" : "app";

const buildRawTraceSignalQuery = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => `
  SELECT
    count() AS total_count,
    countIf(status_code = 2) AS error_count,
    quantileTDigest(0.95)(duration_ns) / 1000000.0 AS p95_ms,
    quantileTDigest(0.99)(duration_ns) / 1000000.0 AS p99_ms,
    countIf(duration_ns <= ${rule.apdexTargetMs ? rule.apdexTargetMs * 1_000_000 : 0} AND status_code != 2) AS satisfied_count,
    countIf(duration_ns > ${rule.apdexTargetMs ? rule.apdexTargetMs * 1_000_000 : 0} AND duration_ns <= ${rule.apdexTargetMs ? rule.apdexTargetMs * 4_000_000 : 0} AND status_code != 2) AS tolerated_count
  FROM traces_raw
  WHERE ${buildTraceRuleWhereClause(rule, windowStartAt, windowEndAt)}
`;

const buildTraceMetricsSignalQuery = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => `
  SELECT
    sum(request_count) AS total_count,
    sum(error_count) AS error_count,
    quantilesTDigestMerge(0.5, 0.95, 0.99)(duration_quantiles)[2] / 1000000.0 AS p95_ms,
    quantilesTDigestMerge(0.5, 0.95, 0.99)(duration_quantiles)[3] / 1000000.0 AS p99_ms,
    0 AS satisfied_count,
    0 AS tolerated_count
  FROM trace_metrics_1m
  WHERE ${buildTraceMetricsRuleWhereClause(rule, windowStartAt, windowEndAt)}
`;

const buildTraceRuleWhereClause = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => {
  const clauses = [
    `app_id = ${quote(rule.appId)}`,
    `start_time >= ${toDateTime64(windowStartAt)}`,
    `start_time < ${toDateTime64(windowEndAt)}`,
    "kind IN (2, 5)",
  ];

  appendInclusionClauses(
    clauses,
    "service_name",
    rule.scopeServicesInclude,
    rule.scopeServicesExclude,
  );
  appendInclusionClauses(clauses, "name", rule.scopeSpanNamesInclude, rule.scopeSpanNamesExclude);
  appendInclusionClauses(
    clauses,
    "deployment_environment",
    rule.scopeEnvironmentsInclude,
    rule.scopeEnvironmentsExclude,
  );
  appendInclusionClauses(clauses, "scope_name", rule.scopeScopesInclude, rule.scopeScopesExclude);

  return clauses.join(" AND ");
};

const buildTraceMetricsRuleWhereClause = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => {
  const clauses = [
    `app_id = ${quote(rule.appId)}`,
    `bucket_start >= ${toDateTime64(windowStartAt)}`,
    `bucket_start < ${toDateTime64(windowEndAt)}`,
  ];

  appendInclusionClauses(
    clauses,
    "service_name",
    rule.scopeServicesInclude,
    rule.scopeServicesExclude,
  );
  appendInclusionClauses(
    clauses,
    "operation_name",
    rule.scopeSpanNamesInclude,
    rule.scopeSpanNamesExclude,
  );
  appendInclusionClauses(
    clauses,
    "deployment_environment",
    rule.scopeEnvironmentsInclude,
    rule.scopeEnvironmentsExclude,
  );
  appendInclusionClauses(
    clauses,
    "scope_name",
    rule.scopeScopesInclude,
    rule.scopeScopesExclude,
  );

  return clauses.join(" AND ");
};

const buildMetricSignalQuery = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => {
  const baseClauses = buildMetricScopeClauses(rule, windowStartAt, windowEndAt);

  switch (rule.signalType) {
    case "container_cpu_utilization":
      return `
        SELECT
          container_id AS entity_id,
          argMax(container_name, time) AS entity_name,
          avg(coalesce(value_double, toFloat64(value_int))) * 100 AS value
        FROM metrics_raw
        WHERE ${[
          ...baseClauses,
          `metric_name = ${quote("container.cpu.utilization")}`,
          "container_id != ''",
        ].join(" AND ")}
        GROUP BY container_id
      `;
    case "container_memory_utilization":
      return `
        SELECT
          container_id AS entity_id,
          argMax(container_name, time) AS entity_name,
          avgIf(toFloat64(value_int), metric_name = ${quote("container.memory.usage.total")}) AS usage_total,
          avgIf(toFloat64(value_int), metric_name = ${quote("container.memory.usage.limit")}) AS usage_limit,
          if(usage_limit > 0, (usage_total / usage_limit) * 100, null) AS value
        FROM metrics_raw
        WHERE ${[
          ...baseClauses,
          `metric_name IN (${quote("container.memory.usage.total")}, ${quote("container.memory.usage.limit")})`,
          "container_id != ''",
        ].join(" AND ")}
        GROUP BY container_id
        HAVING usage_limit > 0
      `;
    case "container_reporting_stale": {
      const discoveryStartAt = new Date(windowEndAt.getTime() - 24 * 60 * 60_000);

      return `
        SELECT
          container_id AS entity_id,
          argMax(container_name, time) AS entity_name,
          greatest(dateDiff('second', max(time), now()), 0) / 60.0 AS value
        FROM metrics_raw
        WHERE ${[
          `app_id = ${quote(rule.appId)}`,
          "entity_kind = 'container'",
          "container_id != ''",
          `time >= ${toDateTime64(discoveryStartAt)}`,
          `time <= ${toDateTime64(windowEndAt)}`,
          ...buildContainerScopeClauses(rule),
        ].join(" AND ")}
        GROUP BY container_id
      `;
    }
  }

  throw new Error(`Unsupported metric alert signal: ${rule.signalType}`);
};

const buildMetricScopeClauses = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => {
  const clauses = [
    `app_id = ${quote(rule.appId)}`,
    `time >= ${toDateTime64(windowStartAt)}`,
    `time <= ${toDateTime64(windowEndAt)}`,
  ];

  if (rule.signalType.startsWith("container_")) {
    clauses.push(
      "entity_kind = 'container'",
      "container_id != ''",
      ...buildContainerScopeClauses(rule),
    );
  }

  return clauses;
};

const buildContainerScopeClauses = (rule: AlertRuleRow) => {
  const clauses: string[] = [];
  appendInclusionClauses(
    clauses,
    "container_name",
    rule.scopeContainerNamesInclude,
    rule.scopeContainerNamesExclude,
  );

  return clauses;
};

const appendInclusionClauses = (
  clauses: string[],
  column: string,
  includeValues: string[],
  excludeValues: string[],
) => {
  if (includeValues.length > 0) {
    clauses.push(`${column} IN (${includeValues.map((value) => quote(value)).join(", ")})`);
  }

  if (excludeValues.length > 0) {
    clauses.push(`${column} NOT IN (${excludeValues.map((value) => quote(value)).join(", ")})`);
  }
};

const quote = (value: string) => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) => `parseDateTime64BestEffort(${quote(value.toISOString())})`;

export { ThresholdAlertWorker };
