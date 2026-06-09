import type { ClickHouseClient } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { alertIncident, alertRule, deployment } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { logTimeFilterSchema, resolveTimeRange } from "./logs.service";

class InsightsService {
  private logger: Logger;

  constructor(
    private clickhouse: ClickHouseClient,
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("InsightsService");
  }

  async getInsights(
    input: z.infer<typeof getInsightsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getInsights: generating insights", { input, context });

    const validated = getInsightsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const { startAtUtc, endAtUtc } = resolveTimeRange(validated.data.time);
      const rangeMs = endAtUtc.getTime() - startAtUtc.getTime();
      const baselineStart = new Date(startAtUtc.getTime() - rangeMs);
      const baselineEnd = startAtUtc;

      const [
        currentAppLogs,
        baselineAppLogs,
        currentAppTraces,
        baselineAppTraces,
        currentServiceLogs,
        baselineServiceLogs,
        currentServiceTraces,
        baselineServiceTraces,
        currentErrors,
        baselineErrors,
        metrics,
        deployments,
        alertRules,
        openIncidents,
      ] = await Promise.all([
        this.queryAppLogMetrics(context.appId, startAtUtc, endAtUtc),
        this.queryAppLogMetrics(context.appId, baselineStart, baselineEnd),
        this.queryAppTraceMetrics(context.appId, startAtUtc, endAtUtc),
        this.queryAppTraceMetrics(context.appId, baselineStart, baselineEnd),
        this.queryServiceLogMetrics(context.appId, startAtUtc, endAtUtc),
        this.queryServiceLogMetrics(context.appId, baselineStart, baselineEnd),
        this.queryServiceTraceMetrics(context.appId, startAtUtc, endAtUtc),
        this.queryServiceTraceMetrics(
          context.appId,
          baselineStart,
          baselineEnd,
        ),
        this.queryErrorPatterns(context.appId, startAtUtc, endAtUtc),
        this.queryErrorPatterns(context.appId, baselineStart, baselineEnd),
        this.queryMetricsSummary(context.appId, startAtUtc, endAtUtc),
        this.db.query.deployment.findMany({
          where: and(
            eq(deployment.appId, context.appId),
            gte(deployment.startedAt, startAtUtc),
            lte(deployment.startedAt, endAtUtc),
          ),
          orderBy: [desc(deployment.startedAt)],
          limit: 5,
        }),
        this.db.query.alertRule.findMany({
          where: eq(alertRule.appId, context.appId),
          orderBy: [desc(alertRule.updatedAt)],
        }),
        this.db.query.alertIncident.findMany({
          where: and(
            eq(alertIncident.appId, context.appId),
            eq(alertIncident.status, "open"),
          ),
          orderBy: [desc(alertIncident.openedAt)],
        }),
      ]);

      const openIncidentByRuleId = new Map(
        openIncidents.map((incident) => [incident.ruleId, incident]),
      );

      const insights = this.buildInsights({
        appId: context.appId,
        current: {
          appLogs: currentAppLogs,
          appTraces: currentAppTraces,
          serviceLogs: currentServiceLogs,
          serviceTraces: currentServiceTraces,
          errors: currentErrors,
        },
        baseline: {
          appLogs: baselineAppLogs,
          appTraces: baselineAppTraces,
          serviceLogs: baselineServiceLogs,
          serviceTraces: baselineServiceTraces,
          errors: baselineErrors,
        },
        metrics,
        deployments,
        alertRules,
        openIncidentByRuleId,
      });

      insights.sort((a, b) => b.score - a.score);

      return ok({ insights: insights.slice(0, 8) });
    } catch (error) {
      this.logger.error("getInsights: failed to generate insights", error);
      return err("Failed to generate insights.");
    }
  }

  private buildInsights(params: {
    appId: string;
    current: WindowData;
    baseline: WindowData;
    metrics: MetricSummary[];
    deployments: DeploymentRow[];
    alertRules: AlertRuleRow[];
    openIncidentByRuleId: Map<string, AlertIncidentRow>;
  }): Insight[] {
    const {
      appId,
      current,
      baseline,
      metrics,
      deployments,
      alertRules,
      openIncidentByRuleId,
    } = params;

    const insights: Insight[] = [];

    const currentAppTotal =
      (current.appLogs?.total ?? 0) + (current.appTraces?.total ?? 0);
    const currentAppErrors =
      (current.appLogs?.errors ?? 0) + (current.appTraces?.errors ?? 0);
    const baselineAppTotal =
      (baseline.appLogs?.total ?? 0) + (baseline.appTraces?.total ?? 0);
    const baselineAppErrors =
      (baseline.appLogs?.errors ?? 0) + (baseline.appTraces?.errors ?? 0);

    const currentAppErrorRate =
      currentAppTotal > 0 ? currentAppErrors / currentAppTotal : 0;
    const baselineAppErrorRate =
      baselineAppTotal > 0 ? baselineAppErrors / baselineAppTotal : 0;

    const currentAppP95 = current.appTraces?.p95LatencyMs ?? 0;
    const baselineAppP95 = baseline.appTraces?.p95LatencyMs ?? 0;

    // App-level error spike
    if (
      currentAppErrorRate > baselineAppErrorRate * 1.5 &&
      currentAppErrorRate > 0.01
    ) {
      const severity =
        currentAppErrorRate > 0.05
          ? ("critical" as const)
          : ("warning" as const);
      const increaseFactor =
        baselineAppErrorRate > 0
          ? currentAppErrorRate / baselineAppErrorRate
          : 1;
      insights.push({
        id: genId("insg"),
        title: "Error rate spike",
        body: `App-wide error rate increased from ${(baselineAppErrorRate * 100).toFixed(1)}% to ${(currentAppErrorRate * 100).toFixed(1)}% (${increaseFactor.toFixed(1)}x)`,
        severity,
        category: "error_spike",
        score: scoreInsight(severity, 1.0),
        link: `/a/${appId}/logs?levels=error,fatal`,
      });
    }

    // App-level latency regression
    if (
      currentAppP95 > baselineAppP95 * 1.3 &&
      currentAppP95 - baselineAppP95 > 50
    ) {
      const severity =
        currentAppP95 - baselineAppP95 > 500
          ? ("critical" as const)
          : ("warning" as const);
      insights.push({
        id: genId("insg"),
        title: "Latency regression",
        body: `App-wide P95 latency increased from ${Math.round(baselineAppP95)}ms to ${Math.round(currentAppP95)}ms`,
        severity,
        category: "latency_regression",
        score: scoreInsight(severity, 1.0),
        link: `/a/${appId}/traces`,
      });
    }

    // App-level throughput drop
    if (
      baselineAppTotal > 0 &&
      currentAppTotal < baselineAppTotal * 0.5 &&
      currentAppTotal > 0
    ) {
      const dropPct = ((1 - currentAppTotal / baselineAppTotal) * 100).toFixed(
        0,
      );
      insights.push({
        id: genId("insg"),
        title: "Throughput drop",
        body: `Total telemetry volume dropped by ${dropPct}% compared to the previous window`,
        severity: "warning",
        category: "throughput_drop",
        score: scoreInsight("warning", 1.0),
        link: `/a/${appId}/logs`,
      });
    }

    const totalTraceVolume = current.appTraces?.total ?? 0;

    // Per-service insights
    for (const svc of current.serviceTraces) {
      const baselineSvc =
        baseline.serviceTraces.find((s) => s.name === svc.name) ?? null;
      const svcTraceTotal = svc.total ?? 0;
      const svcImpactRatio =
        totalTraceVolume > 0 ? svcTraceTotal / totalTraceVolume : 0;

      if (baselineSvc && baselineSvc.total > 0) {
        const currentSvcErrorRate = svc.total > 0 ? svc.errors / svc.total : 0;
        const baselineSvcErrorRate =
          baselineSvc.total > 0 ? baselineSvc.errors / baselineSvc.total : 0;

        if (
          currentSvcErrorRate > baselineSvcErrorRate * 1.5 &&
          currentSvcErrorRate > 0.02
        ) {
          const severity =
            currentSvcErrorRate > 0.1
              ? ("critical" as const)
              : ("warning" as const);
          insights.push({
            id: genId("insg"),
            title: `Error spike in ${svc.name}`,
            body: `Error rate increased from ${(baselineSvcErrorRate * 100).toFixed(1)}% to ${(currentSvcErrorRate * 100).toFixed(1)}%`,
            severity,
            category: "error_spike",
            score: scoreInsight(severity, svcImpactRatio),
            serviceName: svc.name,
            link: `/a/${appId}/traces?services=${encodeURIComponent(svc.name)}`,
          });
        }

        if (
          svc.p95LatencyMs > baselineSvc.p95LatencyMs * 1.3 &&
          svc.p95LatencyMs - baselineSvc.p95LatencyMs > 50
        ) {
          const severity =
            svc.p95LatencyMs - baselineSvc.p95LatencyMs > 500
              ? ("critical" as const)
              : ("warning" as const);
          insights.push({
            id: genId("insg"),
            title: `Latency regression in ${svc.name}`,
            body: `P95 latency increased from ${Math.round(baselineSvc.p95LatencyMs)}ms to ${Math.round(svc.p95LatencyMs)}ms`,
            severity,
            category: "latency_regression",
            score: scoreInsight(severity, svcImpactRatio),
            serviceName: svc.name,
            link: `/a/${appId}/traces?services=${encodeURIComponent(svc.name)}`,
          });
        }

        if (
          svc.total < baselineSvc.total * 0.4 &&
          svc.total > 0 &&
          baselineSvc.total > 10
        ) {
          const dropPct = ((1 - svc.total / baselineSvc.total) * 100).toFixed(
            0,
          );
          insights.push({
            id: genId("insg"),
            title: `Throughput drop in ${svc.name}`,
            body: `Trace volume dropped by ${dropPct}%`,
            severity: "warning",
            category: "throughput_drop",
            score: scoreInsight("warning", svcImpactRatio),
            serviceName: svc.name,
            link: `/a/${appId}/traces?services=${encodeURIComponent(svc.name)}`,
          });
        }
      }
    }

    // New error patterns
    const baselinePatterns = new Set(
      baseline.errors.map((e) => `${e.serviceName}::${e.pattern}`),
    );

    for (const error of current.errors) {
      const key = `${error.serviceName}::${error.pattern}`;
      if (!baselinePatterns.has(key)) {
        const deploymentBefore = deployments.find(
          (d) =>
            d.serviceName === error.serviceName &&
            new Date(d.startedAt).getTime() <=
              new Date(error.firstSeen).getTime(),
        );

        const severity: "critical" | "warning" | "info" =
          error.occurrences > 100
            ? "critical"
            : error.occurrences > 10
              ? "warning"
              : "info";

        const snippet =
          error.pattern.length > 80
            ? `${error.pattern.slice(0, 80)}...`
            : error.pattern;

        const deploymentText = deploymentBefore
          ? ` first appeared after deployment ${deploymentBefore.version?.slice(0, 7) ?? "unknown"}`
          : " first appeared in this window";

        insights.push({
          id: genId("insg"),
          title: `New error pattern in ${error.serviceName}`,
          body: `${error.occurrences.toLocaleString()} occurrences of "${snippet}"${deploymentText}`,
          severity,
          category: "new_error_pattern",
          score: scoreInsight(severity, 0.3),
          serviceName: error.serviceName,
          link: `/a/${appId}/logs?services=${encodeURIComponent(error.serviceName)}&levels=error,fatal`,
        });
      }
    }

    // Metric anomalies
    for (const metric of metrics) {
      if (metric.maxValue > metric.avgValue * 3 && metric.maxValue > 0) {
        insights.push({
          id: genId("insg"),
          title: `Metric spike: ${metric.metricName}`,
          body: `${metric.metricName} on ${metric.serviceName} peaked at ${formatMetricValue(metric.maxValue)} (avg ${formatMetricValue(metric.avgValue)})`,
          severity: "info",
          category: "metric_anomaly",
          score: scoreInsight("info", 0.2),
          serviceName: metric.serviceName,
        });
      }
    }

    // Active alerts
    for (const rule of alertRules) {
      const incident = openIncidentByRuleId.get(rule.id);
      if (incident) {
        insights.push({
          id: genId("insg"),
          title: `Active alert: ${rule.name}`,
          body: `${rule.name} is currently firing`,
          severity: "critical",
          category: "active_alert",
          score: scoreInsight("critical", 1.0),
          link: `/a/${appId}/alerts`,
        });
      }
    }

    // Deployment info for recent deployments without detected issues
    if (insights.length < 3 && deployments.length > 0) {
      for (const dep of deployments.slice(0, 2)) {
        insights.push({
          id: genId("insg"),
          title: `Deployment: ${dep.serviceName}`,
          body: `Version ${dep.version?.slice(0, 7) ?? "unknown"} deployed to ${dep.environmentName}`,
          severity: "info",
          category: "deployment_impact",
          score: scoreInsight("info", 0.1),
          link: `/a/${appId}/deployments`,
        });
      }
    }

    return insights;
  }

  private async queryAppLogMetrics(appId: string, startAt: Date, endAt: Date) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          count() AS total,
          countIf(lowerUTF8(severity_text) IN ('fatal', 'error') OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors
        FROM logs_raw
        WHERE app_id = ${quote(appId)} AND timestamp >= ${toDateTime64(startAt)} AND timestamp <= ${toDateTime64(endAt)}
      `,
    });
    const [row] = (await result.json()) as unknown as Array<{
      total: number | string;
      errors: number | string;
    }>;
    return {
      total: Number(row?.total ?? 0),
      errors: Number(row?.errors ?? 0),
    };
  }

  private async queryAppTraceMetrics(
    appId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          uniqExact(trace_id) AS total,
          uniqExactIf(trace_id, status_code = 2) AS errors,
          quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
        FROM traces_raw
        WHERE app_id = ${quote(appId)} AND start_time >= ${toDateTime64(startAt)} AND start_time <= ${toDateTime64(endAt)}
      `,
    });
    const [row] = (await result.json()) as unknown as Array<{
      total: number | string;
      errors: number | string;
      p95_latency_ms: number | string;
    }>;
    return {
      total: Number(row?.total ?? 0),
      errors: Number(row?.errors ?? 0),
      p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
    };
  }

  private async queryServiceLogMetrics(
    appId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          service_name,
          count() AS total,
          countIf(lowerUTF8(severity_text) IN ('fatal', 'error') OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors
        FROM logs_raw
        WHERE app_id = ${quote(appId)} AND timestamp >= ${toDateTime64(startAt)} AND timestamp <= ${toDateTime64(endAt)}
        GROUP BY service_name
        ORDER BY total DESC
        LIMIT 20
      `,
    });
    const rows = (await result.json()) as unknown as Array<{
      service_name: string;
      total: number | string;
      errors: number | string;
    }>;
    return rows.map((row) => ({
      name: row.service_name,
      total: Number(row.total),
      errors: Number(row.errors),
    }));
  }

  private async queryServiceTraceMetrics(
    appId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          service_name,
          count() AS total,
          countIf(status_code = 2) AS errors,
          quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
        FROM traces_raw
        WHERE app_id = ${quote(appId)} AND start_time >= ${toDateTime64(startAt)} AND start_time <= ${toDateTime64(endAt)}
        GROUP BY service_name
        ORDER BY total DESC
        LIMIT 20
      `,
    });
    const rows = (await result.json()) as unknown as Array<{
      service_name: string;
      total: number | string;
      errors: number | string;
      p95_latency_ms: number | string;
    }>;
    return rows.map((row) => ({
      name: row.service_name,
      total: Number(row.total),
      errors: Number(row.errors),
      p95LatencyMs: Number(row.p95_latency_ms ?? 0),
    }));
  }

  private async queryErrorPatterns(appId: string, startAt: Date, endAt: Date) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          service_name,
          trimBoth(substring(
            replaceRegexpAll(
              replaceRegexpAll(
                replaceRegexpAll(body, '[0-9a-fA-F]{32,}', '<HASH>'),
                '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<UUID>'
              ),
              '[0-9]{4,}', '<NUM>'
            ), 1, 200
          )) AS pattern,
          count() AS occurrences,
          min(timestamp) AS first_seen,
          max(timestamp) AS last_seen
        FROM logs_raw
        WHERE app_id = ${quote(appId)} AND timestamp >= ${toDateTime64(startAt)} AND timestamp <= ${toDateTime64(endAt)}
          AND (lowerUTF8(severity_text) IN ('fatal', 'error') OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0)
        GROUP BY service_name, pattern
        HAVING length(pattern) > 0
        ORDER BY occurrences DESC
        LIMIT 30
      `,
    });
    const rows = (await result.json()) as unknown as Array<{
      service_name: string;
      pattern: string;
      occurrences: number | string;
      first_seen: string | Date;
      last_seen: string | Date;
    }>;
    return rows.map((row) => ({
      serviceName: row.service_name,
      pattern: row.pattern,
      occurrences: Number(row.occurrences),
      firstSeen:
        row.first_seen instanceof Date
          ? row.first_seen.toISOString()
          : normalizeDateTime(row.first_seen),
      lastSeen:
        row.last_seen instanceof Date
          ? row.last_seen.toISOString()
          : normalizeDateTime(row.last_seen),
    }));
  }

  private async queryMetricsSummary(appId: string, startAt: Date, endAt: Date) {
    try {
      const result = await this.clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            metric_name,
            service_name,
            avg(value_double) AS avg_value,
            max(value_double) AS max_value,
            count() AS points
          FROM metrics_raw
          WHERE app_id = ${quote(appId)} AND time >= ${toDateTime64(startAt)} AND time <= ${toDateTime64(endAt)}
            AND metric_type IN ('gauge', 'sum')
            AND value_double IS NOT NULL
          GROUP BY metric_name, service_name
          HAVING points >= 2
          ORDER BY max_value DESC
          LIMIT 20
        `,
      });
      const rows = (await result.json()) as unknown as Array<{
        metric_name: string;
        service_name: string;
        avg_value: number | string;
        max_value: number | string;
        points: number | string;
      }>;
      return rows.map((row) => ({
        metricName: row.metric_name,
        serviceName: row.service_name,
        avgValue: Number(row.avg_value ?? 0),
        maxValue: Number(row.max_value ?? 0),
        points: Number(row.points),
      }));
    } catch {
      // metrics_raw may be empty or unavailable; gracefully degrade
      return [];
    }
  }
}

export const getInsightsInputSchema = z.object({
  time: logTimeFilterSchema,
});

type WindowData = {
  appLogs: { total: number; errors: number };
  appTraces: { total: number; errors: number; p95LatencyMs: number };
  serviceLogs: Array<{ name: string; total: number; errors: number }>;
  serviceTraces: Array<{
    name: string;
    total: number;
    errors: number;
    p95LatencyMs: number;
  }>;
  errors: Array<{
    serviceName: string;
    pattern: string;
    occurrences: number;
    firstSeen: string;
    lastSeen: string;
  }>;
};

type MetricSummary = {
  metricName: string;
  serviceName: string;
  avgValue: number;
  maxValue: number;
  points: number;
};

type DeploymentRow = {
  id: string;
  appId: string;
  serviceName: string;
  environmentName: string;
  version: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
};

type AlertRuleRow = {
  id: string;
  appId: string;
  name: string;
};

type AlertIncidentRow = {
  id: string;
  ruleId: string;
  appId: string;
  status: string;
  openedAt: Date;
};

type InsightSeverity = "critical" | "warning" | "info";
type InsightCategory =
  | "error_spike"
  | "latency_regression"
  | "throughput_drop"
  | "new_error_pattern"
  | "deployment_impact"
  | "active_alert"
  | "metric_anomaly";

type Insight = {
  id: string;
  title: string;
  body: string;
  severity: InsightSeverity;
  category: InsightCategory;
  score: number;
  serviceName?: string;
  link?: string;
};

const scoreInsight = (severity: InsightSeverity, impactRatio: number) => {
  const weights = { critical: 100, warning: 50, info: 10 };
  return weights[severity] * Math.max(impactRatio, 0.01);
};

const formatMetricValue = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value >= 1) return `${value.toFixed(1)}`;
  return value.toFixed(3);
};

const quote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) =>
  `parseDateTime64BestEffort(${quote(value.toISOString())})`;

const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value.includes("T")) {
    return value.endsWith("Z") ? value : `${value}Z`;
  }

  return `${value.replace(" ", "T")}Z`;
};

export { InsightsService };
