import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { AlertRuleService } from "./alert-rule.service";
import type { AppService } from "./app.service";
import type { InsightsService } from "./insights.service";
import type { LogsService } from "./logs.service";
import type { TracesService } from "./traces.service";

type CreateOrvoAssistantToolsOptions = {
  app: {
    id: string;
    name: string;
    defaultTimezone: string;
  };
  organizationId: string;
  appService: AppService;
  logsService: LogsService;
  tracesService: TracesService;
  alertRuleService: AlertRuleService;
  insightsService: InsightsService;
};

const timePresetSchema = z
  .enum([
    "last_hour",
    "today",
    "last_24_hours",
    "last_3_days",
    "last_7_days",
    "last_2_weeks",
    "last_month",
  ])
  .default("last_24_hours");

const stringListSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(25)
  .default([]);
const limitSchema = z.number().int().min(1).max(50).default(20);
const errorLevels = ["error", "fatal", "Error", "Fatal", "ERROR", "FATAL"];

const toTimeFilter = (preset: z.infer<typeof timePresetSchema>) => ({
  kind: "preset" as const,
  preset,
});

const truncate = (value: string, maxLength = 600) => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 3)}...`;
};

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const summarizeBuckets = (
  buckets: Array<{
    startAtUtc: string;
    endAtUtc: string;
    fatal: number;
    error: number;
    warn: number;
    info: number;
    debug: number;
    trace: number;
    total: number;
  }>,
) => {
  const totals = buckets.reduce(
    (acc, bucket) => ({
      fatal: acc.fatal + bucket.fatal,
      error: acc.error + bucket.error,
      warn: acc.warn + bucket.warn,
      info: acc.info + bucket.info,
      debug: acc.debug + bucket.debug,
      trace: acc.trace + bucket.trace,
      total: acc.total + bucket.total,
    }),
    { fatal: 0, error: 0, warn: 0, info: 0, debug: 0, trace: 0, total: 0 },
  );
  const busiestBucket =
    buckets.toSorted((a, b) => b.total - a.total)[0] ?? null;

  return {
    totals,
    bucketCount: buckets.length,
    busiestBucket,
  };
};

const compactLog = (
  log: {
    id: string;
    timestamp: string;
    severity_text: string;
    body: string;
    trace_id: string;
    span_id: string;
    service_name: string;
    deployment_environment: string;
  },
  appId: string,
) => ({
  id: log.id,
  timestamp: log.timestamp,
  level: log.severity_text,
  message: truncate(log.body),
  traceId: log.trace_id || null,
  spanId: log.span_id || null,
  service: log.service_name || null,
  environment: log.deployment_environment || null,
  links: {
    logs: `/a/${appId}/logs`,
    trace: log.trace_id ? `/a/${appId}/traces/${log.trace_id}` : null,
  },
});

const compactTrace = (
  trace: {
    trace_id: string;
    name: string;
    start_time: string;
    end_time: string;
    duration_ns: string | number;
    span_count: string | number;
    error_count: string | number;
    service_names: string[];
    deployment_environments: string[];
  },
  appId: string,
) => ({
  traceId: trace.trace_id,
  name: trace.name || "(unnamed trace)",
  startTime: trace.start_time,
  endTime: trace.end_time,
  durationMs: Math.round(toNumber(trace.duration_ns) / 1_000_000),
  spanCount: toNumber(trace.span_count),
  errorCount: toNumber(trace.error_count),
  services: trace.service_names,
  environments: trace.deployment_environments,
  link: `/a/${appId}/traces/${trace.trace_id}`,
});

const compactSpan = (span: {
  id: string;
  span_id: string;
  parent_span_id: string;
  name: string;
  kind: number;
  start_time: string;
  end_time: string;
  duration_ns: string | number;
  status_code: number;
  status_message: string;
  service_name: string;
  deployment_environment: string;
}) => ({
  id: span.id,
  spanId: span.span_id,
  parentSpanId: span.parent_span_id || null,
  name: span.name || "(unnamed span)",
  kind: span.kind,
  startTime: span.start_time,
  endTime: span.end_time,
  durationMs: Math.round(toNumber(span.duration_ns) / 1_000_000),
  statusCode: span.status_code,
  statusMessage: span.status_message || null,
  service: span.service_name || null,
  environment: span.deployment_environment || null,
});

const createOrvoAssistantTools = ({
  app,
  organizationId,
  appService,
  logsService,
  tracesService,
  alertRuleService,
  insightsService,
}: CreateOrvoAssistantToolsOptions) =>
  ({
    getInsights: tool({
      description:
        "Generate intelligent insights for the app by comparing current telemetry against a baseline window. Detects error spikes, latency regressions, throughput drops, new error patterns, metric anomalies, active alerts, and recent deployments. Use this when the user asks for an overview, health check, or wants to know what is wrong with their app.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
      }),
      execute: async ({ timePreset }) => {
        const result = await insightsService.getInsights(
          { time: toTimeFilter(timePreset) },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        return {
          ok: true,
          insightCount: result.data.insights.length,
          insights: result.data.insights.map((insight) => ({
            id: insight.id,
            title: insight.title,
            body: insight.body,
            severity: insight.severity,
            category: insight.category,
            score: insight.score,
            serviceName: insight.serviceName ?? null,
            link: insight.link ?? null,
          })),
        };
      },
    }),
    getAppOverview: tool({
      description:
        "Get the currently selected Orvo app metadata and useful internal navigation links.",
      inputSchema: z.object({}),
      execute: async () => {
        const appResult = await appService.getApp(
          { id: app.id },
          { organizationId },
        );

        if (!appResult.success) {
          return { ok: false, error: appResult.error };
        }

        return {
          ok: true,
          app: {
            id: appResult.data.app.id,
            name: appResult.data.app.name,
            defaultTimezone: appResult.data.app.defaultTimezone,
            createdAt: appResult.data.app.createdAt,
            updatedAt: appResult.data.app.updatedAt,
          },
          links: {
            overview: `/a/${app.id}/overview`,
            logs: `/a/${app.id}/logs`,
            traces: `/a/${app.id}/traces`,
            alerts: `/a/${app.id}/alerts`,
            settings: `/a/${app.id}/settings`,
          },
        };
      },
    }),
    getLogVolume: tool({
      description:
        "Summarize log volume by severity for a selected time preset. Use this before claiming whether logs increased or errors are present.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
        search: z.string().trim().max(500).default(""),
        services: stringListSchema,
        environments: stringListSchema,
      }),
      execute: async ({ timePreset, search, services, environments }) => {
        const result = await logsService.getLogVolume(
          {
            time: toTimeFilter(timePreset),
            search,
            levels: [],
            services,
            environments,
            scopes: [],
            ingestionKeyIds: [],
            bucketCount: 48,
          },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        return {
          ok: true,
          timePreset,
          summary: summarizeBuckets(result.data.buckets),
          link: `/a/${app.id}/logs`,
        };
      },
    }),
    searchLogs: tool({
      description:
        "Search recent logs for messages, levels, services, environments, trace IDs, or span IDs. Return specific examples and links.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
        search: z.string().trim().max(500).default(""),
        levels: stringListSchema,
        services: stringListSchema,
        environments: stringListSchema,
        traceId: z.string().trim().max(255).optional(),
        spanId: z.string().trim().max(255).optional(),
        limit: limitSchema,
      }),
      execute: async ({
        timePreset,
        search,
        levels,
        services,
        environments,
        traceId,
        spanId,
        limit,
      }) => {
        const result = await logsService.getLogs(
          {
            time: toTimeFilter(timePreset),
            search,
            levels,
            services,
            environments,
            scopes: [],
            ingestionKeyIds: [],
            traceId,
            spanId,
            limit,
          },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        return {
          ok: true,
          timePreset,
          count: result.data.logs.length,
          logs: result.data.logs.map((log) => compactLog(log, app.id)),
          nextCursor: result.data.nextCursor,
          link: `/a/${app.id}/logs`,
        };
      },
    }),
    getRecentErrors: tool({
      description:
        "Get recent error and fatal logs. Use this for questions about failures, exceptions, regressions, or incident triage.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
        services: stringListSchema,
        environments: stringListSchema,
        limit: limitSchema,
      }),
      execute: async ({ timePreset, services, environments, limit }) => {
        const result = await logsService.getLogs(
          {
            time: toTimeFilter(timePreset),
            search: "",
            levels: errorLevels,
            services,
            environments,
            scopes: [],
            ingestionKeyIds: [],
            limit,
          },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        return {
          ok: true,
          timePreset,
          count: result.data.logs.length,
          errors: result.data.logs.map((log) => compactLog(log, app.id)),
          link: `/a/${app.id}/logs`,
        };
      },
    }),
    searchTraces: tool({
      description:
        "Search traces by name, trace ID, service, environment, or status code. Use for latency, path, span, and request-flow questions.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
        search: z.string().trim().max(500).default(""),
        services: stringListSchema,
        environments: stringListSchema,
        statusCodes: z
          .array(z.number().int().min(0).max(255))
          .max(10)
          .default([]),
        limit: limitSchema,
      }),
      execute: async ({
        timePreset,
        search,
        services,
        environments,
        statusCodes,
        limit,
      }) => {
        const result = await tracesService.getTraces(
          {
            time: toTimeFilter(timePreset),
            search,
            services,
            environments,
            scopes: [],
            ingestionKeyIds: [],
            statusCodes,
            limit,
          },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        return {
          ok: true,
          timePreset,
          count: result.data.traces.length,
          traces: result.data.traces.map((trace) =>
            compactTrace(trace, app.id),
          ),
          nextCursor: result.data.nextCursor,
          link: `/a/${app.id}/traces`,
        };
      },
    }),
    getTraceDetails: tool({
      description:
        "Get the spans inside a specific trace ID. Use this when the user asks why a request was slow or failed.",
      inputSchema: z.object({
        traceId: z.string().trim().min(1).max(255),
      }),
      execute: async ({ traceId }) => {
        const result = await tracesService.getTrace(
          { traceId },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        const spans = result.data.spans.map(compactSpan);
        const services = [
          ...new Set(spans.map((span) => span.service).filter(Boolean)),
        ];
        const errorSpans = spans.filter((span) => span.statusCode === 2);
        const slowestSpans = spans
          .toSorted((a, b) => b.durationMs - a.durationMs)
          .slice(0, 10);

        return {
          ok: true,
          traceId,
          spanCount: spans.length,
          services,
          errorCount: errorSpans.length,
          errorSpans: errorSpans.slice(0, 10),
          slowestSpans,
          spans: spans.slice(0, 80),
          truncated: spans.length > 80,
          link: `/a/${app.id}/traces/${traceId}`,
        };
      },
    }),
    getSlowTraces: tool({
      description:
        "Find the slowest traces in a time preset, optionally scoped by service or environment.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
        services: stringListSchema,
        environments: stringListSchema,
        minDurationMs: z.number().int().min(0).max(3_600_000).default(0),
        limit: limitSchema,
      }),
      execute: async ({
        timePreset,
        services,
        environments,
        minDurationMs,
        limit,
      }) => {
        const result = await tracesService.getTraces(
          {
            time: toTimeFilter(timePreset),
            search: "",
            services,
            environments,
            scopes: [],
            ingestionKeyIds: [],
            statusCodes: [],
            limit: 100,
          },
          { appId: app.id },
        );

        if (!result.success) {
          return { ok: false, error: result.error };
        }

        const traces = result.data.traces
          .map((trace) => compactTrace(trace, app.id))
          .filter((trace) => trace.durationMs >= minDurationMs)
          .toSorted((a, b) => b.durationMs - a.durationMs)
          .slice(0, limit);

        return {
          ok: true,
          timePreset,
          count: traces.length,
          traces,
          link: `/a/${app.id}/traces`,
        };
      },
    }),
    getAlertCoverage: tool({
      description:
        "Inspect enabled alert rules and recent telemetry, then suggest missing read-only alert coverage. Do not create or update alerts.",
      inputSchema: z.object({
        timePreset: timePresetSchema,
      }),
      execute: async ({ timePreset }) => {
        const [rulesResult, volumeResult, errorsResult, slowTracesResult] =
          await Promise.all([
            alertRuleService.getAlertRules({ appId: app.id }),
            logsService.getLogVolume(
              {
                time: toTimeFilter(timePreset),
                search: "",
                levels: [],
                services: [],
                environments: [],
                scopes: [],
                ingestionKeyIds: [],
                bucketCount: 24,
              },
              { appId: app.id },
            ),
            logsService.getLogs(
              {
                time: toTimeFilter(timePreset),
                search: "",
                levels: errorLevels,
                services: [],
                environments: [],
                scopes: [],
                ingestionKeyIds: [],
                limit: 10,
              },
              { appId: app.id },
            ),
            tracesService.getTraces(
              {
                time: toTimeFilter(timePreset),
                search: "",
                services: [],
                environments: [],
                scopes: [],
                ingestionKeyIds: [],
                statusCodes: [],
                limit: 100,
              },
              { appId: app.id },
            ),
          ]);

        if (!rulesResult.success) {
          return { ok: false, error: rulesResult.error };
        }

        if (!volumeResult.success) {
          return { ok: false, error: volumeResult.error };
        }

        if (!errorsResult.success) {
          return { ok: false, error: errorsResult.error };
        }

        if (!slowTracesResult.success) {
          return { ok: false, error: slowTracesResult.error };
        }

        const rules = rulesResult.data.rules;
        const signals = new Set(rules.map((rule) => rule.signalType));
        const volume = summarizeBuckets(volumeResult.data.buckets);
        const slowTraces = slowTracesResult.data.traces
          .map((trace) => compactTrace(trace, app.id))
          .toSorted((a, b) => b.durationMs - a.durationMs)
          .slice(0, 10);
        const suggestions: Array<{ type: string; reason: string }> = [];

        if (
          (volume.totals.error > 0 || volume.totals.fatal > 0) &&
          !signals.has("error_rate")
        ) {
          suggestions.push({
            type: "error_rate",
            reason:
              "Recent error or fatal logs exist, but there is no error-rate rule.",
          });
        }

        if (
          slowTraces.some((trace) => trace.durationMs >= 1000) &&
          !signals.has("latency_p95_ms")
        ) {
          suggestions.push({
            type: "latency_p95_ms",
            reason:
              "At least one recent trace is over 1s, but there is no p95 latency rule.",
          });
        }

        if (!signals.has("throughput_per_min")) {
          suggestions.push({
            type: "throughput_per_min",
            reason:
              "A throughput rule helps detect sudden drops or spikes in traffic.",
          });
        }

        return {
          ok: true,
          timePreset,
          rules: rules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            signalType: rule.signalType,
            comparator: rule.comparator,
            threshold: rule.threshold,
            windowMinutes: rule.windowMinutes,
            isEnabled: rule.isEnabled,
            destinationCount: rule.destinationCount,
            openIncident: rule.openIncident
              ? {
                  id: rule.openIncident.id,
                  openedAt: rule.openIncident.openedAt,
                  lastObservedAt: rule.openIncident.lastObservedAt,
                  lastObservedValue: rule.openIncident.lastObservedValue,
                }
              : null,
          })),
          telemetry: {
            logVolume: volume,
            recentErrors: errorsResult.data.logs.map((log) =>
              compactLog(log, app.id),
            ),
            slowTraces,
          },
          suggestions,
          link: `/a/${app.id}/alerts`,
        };
      },
    }),
  }) satisfies ToolSet;

export { createOrvoAssistantTools };
