import { ok } from "@repo/utils";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ url, locals, params, parent }) => {
  const { currentApp } = await parent();

  const time = (
    ["30m", "1h", "4h", "24h", "7d"].includes(url.searchParams.get("t") ?? "")
      ? url.searchParams.get("t")
      : "1h"
  ) as "30m" | "1h" | "4h" | "24h" | "7d";

  const timeFilter = {
    kind: "preset" as const,
    preset: (
      {
        "30m": "last_30_minutes",
        "1h": "last_hour",
        "4h": "last_4_hours",
        "24h": "last_24_hours",
        "7d": "last_7_days",
      } as const
    )[time],
  };

  const [
    logsRes,
    tracesRes,
    metricsRes,
    traceMetricsRes,
    keyRes,
    insightsRes,
    serviceSummaryRes,
  ] = await Promise.all([
    locals.container.logsService.getLogsTrend(
      { time: timeFilter },
      { appId: params.app_id },
    ),
    locals.container.tracesService.getTracesTrend(
      { time: timeFilter },
      { appId: params.app_id },
    ),
    locals.container.metricsService.getMetricsTrend(
      { time: timeFilter },
      { appId: params.app_id },
    ),
    locals.container.tracesService.getTraceMetrics(
      { time: timeFilter },
      { appId: params.app_id },
    ),
    (async () => {
      if (
        !currentApp.logsFirstReceivedAt &&
        !currentApp.tracesFirstReceivedAt &&
        !currentApp.metricsFirstReceivedAt
      ) {
        return locals.container.ingestionKeyService.getIngestionKey(
          { kind: "private" },
          { appId: params.app_id },
        );
      }
      return ok(null);
    })(),
    locals.container.insightsService.getInsights(
      { time: timeFilter },
      { appId: params.app_id },
    ),
    locals.container.tracesService.getTraceServiceSummary(
      { time: timeFilter },
      { appId: params.app_id },
    ),
  ]);

  if (
    !logsRes.success ||
    !tracesRes.success ||
    !metricsRes.success ||
    !traceMetricsRes.success ||
    !keyRes.success ||
    !insightsRes.success ||
    !serviceSummaryRes.success
  )
    error(500, "Failed to load overview data.");

  const overallP95LatencyMs = traceMetricsRes.data.summary.p95LatencyMs;
  const latencyThreshold = Math.max(overallP95LatencyMs * 1.25, 250);

  const servicesNeedingAttention = serviceSummaryRes.data.services
    .map((service) => ({
      ...service,
      score:
        service.errorRate * 1200 +
        Math.min(service.errors, 200) * 3 +
        (service.p95LatencyMs >= latencyThreshold
          ? (service.p95LatencyMs / latencyThreshold) * 40
          : 0),
      severity:
        service.errors > 0 || service.errorRate >= 0.01
          ? "critical"
          : service.p95LatencyMs >= latencyThreshold
            ? "warning"
            : ("info" as const),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.errors !== left.errors) {
        return right.errors - left.errors;
      }

      if (right.p95LatencyMs !== left.p95LatencyMs) {
        return right.p95LatencyMs - left.p95LatencyMs;
      }

      return right.total - left.total;
    })
    .slice(0, 5)
    .map(({ score: _, severity, ...service }) => ({
      name: service.name,
      total: service.total,
      errors: service.errors,
      errorRate: service.errorRate,
      p95LatencyMs: service.p95LatencyMs,
      buckets: service.buckets,
      severity,
    }));

  return {
    time,
    logTrend: logsRes.data,
    traceTrend: tracesRes.data,
    metricsTrend: metricsRes.data,
    traceMetrics: traceMetricsRes.data,
    ingestionKey: keyRes.data?.key?.key ?? null,
    hasReceivedFirstSignal:
      !!currentApp.logsFirstReceivedAt ||
      !!currentApp.tracesFirstReceivedAt ||
      !!currentApp.metricsFirstReceivedAt,
    insights: insightsRes.data.insights,
    servicesNeedingAttention,
  };
}) satisfies PageServerLoad;
