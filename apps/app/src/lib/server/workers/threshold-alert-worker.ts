import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import {
  alertEvent,
  alertIncident,
  alertRule,
  alertRuleDestination,
  app,
  notificationDelivery,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, asc, desc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";

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
    const windowEndAt = new Date();
    const windowStartAt = new Date(windowEndAt.getTime() - rule.windowMinutes * 60_000);
    const [signals, openIncidents, destinations, currentApp] = await Promise.all([
      this.queryRuleSignals(rule, windowStartAt, windowEndAt),
      this.db.query.alertIncident.findMany({
        where: and(eq(alertIncident.ruleId, rule.id), eq(alertIncident.status, "open")),
        orderBy: [desc(alertIncident.openedAt)],
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
    const incidentId = genId("alin");
    const eventId = genId("alev");
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx.insert(alertIncident).values({
        id: incidentId,
        appId: rule.appId,
        ruleId: rule.id,
        entityType: signal.entityType,
        entityId: signal.entityId,
        entityName: signal.entityName,
        status: "open",
        openedAt: now,
        lastObservedAt: windowEndAt,
        lastObservedValue: signal.value,
        lastNotifiedAt: destinations.length > 0 ? now : null,
      });

      await tx.insert(alertEvent).values({
        id: eventId,
        appId: rule.appId,
        ruleId: rule.id,
        incidentId,
        eventType: "opened",
        windowStartAt,
        windowEndAt,
        observedValue: signal.value,
      });

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

      if (destinations.length > 0) {
        await tx.insert(notificationDelivery).values(
          buildDeliveryRows(
            "alert.opened",
            rule,
            appName,
            incidentId,
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
    incident: typeof alertIncident.$inferSelect,
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
      await tx
        .update(alertIncident)
        .set({
          lastObservedAt: windowEndAt,
          lastObservedValue: value,
          lastNotifiedAt: shouldRenotify ? now : incident.lastNotifiedAt,
          renotifyCount: shouldRenotify ? incident.renotifyCount + 1 : incident.renotifyCount,
        })
        .where(eq(alertIncident.id, incident.id));

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
        await tx.insert(alertEvent).values({
          id: genId("alev"),
          appId: rule.appId,
          ruleId: rule.id,
          incidentId: incident.id,
          eventType: "renotified",
          windowStartAt,
          windowEndAt,
          observedValue: value,
        });

        await tx.insert(notificationDelivery).values(
          buildDeliveryRows(
            "alert.renotified",
            rule,
            appName,
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
    incident: typeof alertIncident.$inferSelect,
    value: number | null,
    windowStartAt: Date,
    windowEndAt: Date,
    destinations: Array<typeof alertRuleDestination.$inferSelect>,
    appName: string,
  ) {
    const now = new Date();
    const eventId = genId("alev");

    await this.db.transaction(async (tx) => {
      await tx
        .update(alertIncident)
        .set({
          status: "resolved",
          resolvedAt: now,
          lastObservedAt: windowEndAt,
          lastObservedValue: value,
        })
        .where(eq(alertIncident.id, incident.id));

      await tx.insert(alertEvent).values({
        id: eventId,
        appId: rule.appId,
        ruleId: rule.id,
        incidentId: incident.id,
        eventType: "resolved",
        windowStartAt,
        windowEndAt,
        observedValue: value,
      });

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
      const query = `
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
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query,
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
}

type AlertRuleRow = typeof alertRule.$inferSelect;
type AlertIncidentRow = typeof alertIncident.$inferSelect;
type AlertRuleDestinationRow = typeof alertRuleDestination.$inferSelect;
type AlertEventName = "alert.opened" | "alert.renotified" | "alert.resolved";
type AlertEntityType = AlertIncidentRow["entityType"];
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
    sourceKind: "alert" as const,
    sourceId: incidentId,
    eventType,
    payload: buildPayload(
      eventType,
      rule,
      appName,
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
    "host_cpu_utilization",
    "host_memory_utilization",
    "host_filesystem_utilization",
    "host_reporting_stale",
    "container_cpu_utilization",
    "container_memory_utilization",
    "container_reporting_stale",
  ].includes(signalType);

const resolveEntityType = (signalType: AlertSignalType): AlertEntityType =>
  signalType.startsWith("host_")
    ? "host"
    : signalType.startsWith("container_")
      ? "container"
      : "app";

const buildTraceRuleWhereClause = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => {
  const clauses = [
    `app_id = ${quote(rule.appId)}`,
    `start_time >= ${toDateTime64(windowStartAt)}`,
    `start_time <= ${toDateTime64(windowEndAt)}`,
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

const buildMetricSignalQuery = (
  rule: AlertRuleRow,
  windowStartAt: Date,
  windowEndAt: Date,
) => {
  const baseClauses = buildMetricScopeClauses(rule, windowStartAt, windowEndAt);

  switch (rule.signalType) {
    case "host_cpu_utilization":
    case "host_memory_utilization":
      return `
        SELECT
          host_id AS entity_id,
          argMax(host_name, time) AS entity_name,
          avg(coalesce(value_double, toFloat64(value_int))) * 100 AS value
        FROM metrics_raw
        WHERE ${[
          ...baseClauses,
          `metric_name = ${quote(
            rule.signalType === "host_cpu_utilization"
              ? "system.cpu.utilization"
              : "system.memory.utilization",
          )}`,
        ].join(" AND ")}
        GROUP BY host_id
      `;
    case "host_filesystem_utilization":
      return `
        SELECT
          host_id AS entity_id,
          argMax(host_name, time) AS entity_name,
          max(coalesce(value_double, toFloat64(value_int))) * 100 AS value
        FROM metrics_raw
        WHERE ${[...baseClauses, `metric_name = ${quote("system.filesystem.utilization")}`].join(" AND ")}
        GROUP BY host_id
      `;
    case "host_reporting_stale": {
      const discoveryStartAt = new Date(windowEndAt.getTime() - 24 * 60 * 60_000);

      return `
        SELECT
          host_id AS entity_id,
          argMax(host_name, time) AS entity_name,
          greatest(dateDiff('second', max(time), now()), 0) / 60.0 AS value
        FROM metrics_raw
        WHERE ${[
          `app_id = ${quote(rule.appId)}`,
          "entity_kind = 'host'",
          "host_id != ''",
          `time >= ${toDateTime64(discoveryStartAt)}`,
          `time <= ${toDateTime64(windowEndAt)}`,
          ...buildHostScopeClauses(rule),
        ].join(" AND ")}
        GROUP BY host_id
      `;
    }
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
          ...buildHostScopeClauses(rule),
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

  if (rule.signalType.startsWith("host_")) {
    clauses.push("entity_kind = 'host'", "host_id != ''", ...buildHostScopeClauses(rule));
  }

  if (rule.signalType.startsWith("container_")) {
    clauses.push(
      "entity_kind = 'container'",
      "container_id != ''",
      ...buildHostScopeClauses(rule),
      ...buildContainerScopeClauses(rule),
    );
  }

  return clauses;
};

const buildHostScopeClauses = (rule: AlertRuleRow) => {
  const clauses: string[] = [];
  appendInclusionClauses(
    clauses,
    "host_name",
    rule.scopeHostNamesInclude,
    rule.scopeHostNamesExclude,
  );

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
