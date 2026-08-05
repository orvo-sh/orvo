import type { HeartbeatService } from "$lib/server/services/heartbeat";
import type { IncidentService } from "$lib/server/services/incident";
import {
  incidentSourceTypeSchema,
  incidentStatusSchema,
} from "$lib/server/services/incident";
import type { LogsService } from "$lib/server/services/logs";
import { getLogsInputSchema } from "$lib/server/services/logs";
import type { MetricsService } from "$lib/server/services/metrics";
import { getMetricsExplorerInputSchema } from "$lib/server/services/metrics";
import { timeFilterSchema } from "$lib/server/services/shared/time-filter";
import type { TracesService } from "$lib/server/services/traces";
import { getTracesInputSchema } from "$lib/server/services/traces";
import { tool } from "ai";
import { z } from "zod";

const defaultTime = {
  kind: "preset",
  preset: "last_hour",
} as const;

const cleanHeartbeat = (monitor: Record<string, unknown>) => {
  const clean = { ...monitor };
  delete clean.token;
  delete clean.url;
  delete clean.secretUrl;
  return clean;
};

const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const result = (
  kind: string,
  value: { success: boolean; data?: unknown; error?: string },
) =>
  value.success
    ? { kind, data: jsonSafe(value.data) }
    : { kind, error: value.error ?? "The telemetry query failed." };

const createChatTools = (
  dependencies: {
    logsService: LogsService;
    tracesService: TracesService;
    metricsService: MetricsService;
    incidentService: IncidentService;
    heartbeatService: HeartbeatService;
  },
  context: { appId: string },
) => ({
  get_app_overview: tool({
    description:
      "Summarize telemetry volume, open incidents, and heartbeat health for the current app.",
    inputSchema: z.object({
      time: timeFilterSchema.optional().default(defaultTime),
    }),
    execute: async ({ time }) => {
      const [logs, traces, metrics, incidents, heartbeats] = await Promise.all([
        dependencies.logsService.getTotalLogs({ time }, context),
        dependencies.tracesService.getTotalTraces({ time }, context),
        dependencies.metricsService.getTotalMetrics({ time }, context),
        dependencies.incidentService.getOpenIncidents({ limit: 10 }, context),
        dependencies.heartbeatService.listHeartbeatMonitors(context),
      ]);

      return {
        kind: "app_overview",
        logs: result("logs_total", logs),
        traces: result("traces_total", traces),
        metrics: result("metrics_total", metrics),
        incidents: result("open_incidents", incidents),
        heartbeats: heartbeats.success
          ? {
              kind: "heartbeat_monitors",
              data: jsonSafe({
                ...heartbeats.data,
                monitors: heartbeats.data.monitors.map((monitor) =>
                  cleanHeartbeat(monitor as unknown as Record<string, unknown>),
                ),
              }),
            }
          : result("heartbeat_monitors", heartbeats),
      };
    },
  }),
  search_logs: tool({
    description:
      "Search logs in the current app using time, structured filters, sorting, and pagination.",
    inputSchema: getLogsInputSchema.extend({
      time: timeFilterSchema.optional().default(defaultTime),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    execute: async (input) =>
      result(
        "log_search",
        await dependencies.logsService.getLogs(input, context),
      ),
  }),
  get_log: tool({
    description: "Load one log from the current app by its ID.",
    inputSchema: z.object({ id: z.string().trim().min(1).max(255) }),
    execute: async (input) =>
      result("log", await dependencies.logsService.getLogById(input, context)),
  }),
  search_traces: tool({
    description:
      "Search traces in the current app using time, services, status, duration, attributes, sorting, and pagination.",
    inputSchema: getTracesInputSchema.extend({
      time: timeFilterSchema.optional().default(defaultTime),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    execute: async (input) =>
      result(
        "trace_search",
        await dependencies.tracesService.getTraces(input, context),
      ),
  }),
  get_trace: tool({
    description:
      "Load a trace and all of its spans from the current app by trace ID.",
    inputSchema: z.object({ id: z.string().trim().min(1).max(255) }),
    execute: async (input) =>
      result(
        "trace",
        await dependencies.tracesService.getTrace(input, context),
      ),
  }),
  get_service_graph: tool({
    description:
      "Load the trace-derived service graph for the current app over a selected time window.",
    inputSchema: z.object({
      time: timeFilterSchema.optional().default(defaultTime),
    }),
    execute: async (input) =>
      result(
        "service_graph",
        await dependencies.tracesService.getServiceGraph(input, context),
      ),
  }),
  query_metrics: tool({
    description:
      "Query metric series, facets, catalog entries, and recent samples for the current app.",
    inputSchema: getMetricsExplorerInputSchema.extend({
      time: timeFilterSchema.optional().default(defaultTime),
      bucketCount: z.number().int().min(10).max(120).default(60),
      sampleLimit: z.number().int().min(1).max(50).default(25),
    }),
    execute: async (input) =>
      result(
        "metrics_query",
        await dependencies.metricsService.getMetricsExplorer(input, context),
      ),
  }),
  list_incidents: tool({
    description:
      "List incidents in the current app, optionally filtered by status, source, or entity.",
    inputSchema: z.object({
      status: incidentStatusSchema.default("all"),
      sourceType: incidentSourceTypeSchema.optional(),
      sourceId: z.string().trim().min(1).optional(),
      entityId: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    execute: async (input) =>
      result(
        "incident_list",
        await dependencies.incidentService.listIncidents(input, context),
      ),
  }),
  get_incident: tool({
    description:
      "Load one incident and its event history from the current app.",
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    execute: async ({ id }) =>
      result(
        "incident",
        await dependencies.incidentService.getIncidentDetail(id, context),
      ),
  }),
  list_heartbeat_monitors: tool({
    description:
      "List heartbeat monitors and their health in the current app. Secret URLs and tokens are never returned.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }),
    execute: async ({ limit }) => {
      const monitors =
        await dependencies.heartbeatService.listHeartbeatMonitors(context);
      return monitors.success
        ? {
            kind: "heartbeat_monitor_list",
            data: jsonSafe(
              monitors.data.monitors
                .slice(0, limit)
                .map((monitor) =>
                  cleanHeartbeat(monitor as unknown as Record<string, unknown>),
                ),
            ),
          }
        : result("heartbeat_monitor_list", monitors);
    },
  }),
  get_heartbeat_monitor: tool({
    description:
      "Load one heartbeat monitor from the current app. Secret URLs and tokens are never returned.",
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    execute: async ({ id }) => {
      const monitor = await dependencies.heartbeatService.getHeartbeatMonitor(
        id,
        context,
      );
      return monitor.success
        ? {
            kind: "heartbeat_monitor",
            data: jsonSafe(
              cleanHeartbeat(
                monitor.data.monitor as unknown as Record<string, unknown>,
              ),
            ),
          }
        : result("heartbeat_monitor", monitor);
    },
  }),
});

export { createChatTools };
