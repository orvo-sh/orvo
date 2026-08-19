import type { AlertRuleService } from "$lib/server/services/alert-rule";
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

import {
  compactHeartbeat,
  compactIncident,
  compactToolOutput,
  createToolOutputBudget,
} from "./compact";

const defaultTime = {
  kind: "preset",
  preset: "last_hour",
} as const;

const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const result = (
  toolName: string,
  value: { success: boolean; data?: unknown; error?: string },
) =>
  jsonSafe(
    compactToolOutput(
      toolName,
      value.success
        ? { data: value.data }
        : { error: value.error ?? "The telemetry query failed." },
    ),
  );

const createChatTools = (
  dependencies: {
    alertRuleService: AlertRuleService;
    logsService: LogsService;
    tracesService: TracesService;
    metricsService: MetricsService;
    incidentService: IncidentService;
    heartbeatService: HeartbeatService;
  },
  context: { appId: string },
) => {
  const withinOutputBudget = createToolOutputBudget();
  const toolResult = (
    toolName: string,
    value: { success: boolean; data?: unknown; error?: string },
  ) => withinOutputBudget(result(toolName, value));

  return {
    get_app_overview: tool({
      description:
        "Summarize telemetry volume, open incidents, heartbeat health, and alert rules for the current app.",
      inputSchema: z.object({
        time: timeFilterSchema.optional().default(defaultTime),
      }),
      execute: async ({ time }) => {
        const [logs, traces, metrics, incidents, heartbeats, alerts] =
          await Promise.all([
            dependencies.logsService.getTotalLogs({ time }, context),
            dependencies.tracesService.getTotalTraces({ time }, context),
            dependencies.metricsService.getTotalMetrics({ time }, context),
            dependencies.incidentService.getOpenIncidents(
              { limit: 10 },
              context,
            ),
            dependencies.heartbeatService.listHeartbeatMonitors(context),
            dependencies.alertRuleService.getAlertRules(context),
          ]);
        const heartbeatMonitors = heartbeats.success
          ? heartbeats.data.monitors
          : [];

        return withinOutputBudget({
          data: jsonSafe({
            logs: logs.success ? logs.data : { error: logs.error },
            traces: traces.success ? traces.data : { error: traces.error },
            metrics: metrics.success ? metrics.data : { error: metrics.error },
            incidents: incidents.success
              ? incidents.data.incidents
                  .slice(0, 10)
                  .map((incident) => compactIncident(incident))
              : { error: incidents.error },
            heartbeats: heartbeats.success
              ? {
                  total: heartbeatMonitors.length,
                  byStatus: heartbeatMonitors.reduce<Record<string, number>>(
                    (counts, monitor) => ({
                      ...counts,
                      [monitor.status]: (counts[monitor.status] ?? 0) + 1,
                    }),
                    {},
                  ),
                  attention: heartbeatMonitors
                    .filter(
                      (monitor) =>
                        monitor.status !== "healthy" || monitor.isPaused,
                    )
                    .slice(0, 10)
                    .map((monitor) => compactHeartbeat(monitor)),
                }
              : { error: heartbeats.error },
            alerts: alerts.success
              ? {
                  total: alerts.data.rules.length,
                  enabled: alerts.data.rules.filter((rule) => rule.isEnabled)
                    .length,
                  withOpenIncidents: alerts.data.rules.filter(
                    (rule) => rule.openIncidentCount > 0,
                  ).length,
                }
              : { error: alerts.error },
          }),
        });
      },
    }),
    search_logs: tool({
      description:
        "Search logs in the current app using time, structured filters, sorting, and pagination.",
      inputSchema: getLogsInputSchema.extend({
        time: timeFilterSchema.optional().default(defaultTime),
        limit: z.number().int().min(1).max(25).default(20),
      }),
      execute: async (input) =>
        toolResult(
          "search_logs",
          await dependencies.logsService.getLogs(input, context),
        ),
    }),
    get_log: tool({
      description: "Load one log from the current app by its ID.",
      inputSchema: z.object({ id: z.string().trim().min(1).max(255) }),
      execute: async (input) =>
        toolResult(
          "get_log",
          await dependencies.logsService.getLogById(input, context),
        ),
    }),
    search_traces: tool({
      description:
        "Search traces in the current app using time, services, status, duration, attributes, sorting, and pagination.",
      inputSchema: getTracesInputSchema.extend({
        time: timeFilterSchema.optional().default(defaultTime),
        limit: z.number().int().min(1).max(25).default(20),
      }),
      execute: async (input) =>
        toolResult(
          "search_traces",
          await dependencies.tracesService.getTraces(input, context),
        ),
    }),
    get_trace: tool({
      description:
        "Load a trace's root, error, and slow spans by trace ID. Very large traces are bounded.",
      inputSchema: z.object({ id: z.string().trim().min(1).max(255) }),
      execute: async (input) =>
        toolResult(
          "get_trace",
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
        toolResult(
          "get_service_graph",
          await dependencies.tracesService.getServiceGraph(input, context),
        ),
    }),
    query_metrics: tool({
      description:
        "Query the metric catalog or compact time series for the current app.",
      inputSchema: getMetricsExplorerInputSchema
        .omit({ sampleLimit: true })
        .extend({
          time: timeFilterSchema.optional().default(defaultTime),
          bucketCount: z.number().int().min(10).max(60).default(30),
        }),
      execute: async (input) =>
        toolResult(
          "query_metrics",
          await dependencies.metricsService.getMetricsExplorer(
            { ...input, sampleLimit: 1 },
            context,
          ),
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
        limit: z.number().int().min(1).max(25).default(20),
      }),
      execute: async (input) =>
        toolResult(
          "list_incidents",
          await dependencies.incidentService.listIncidents(input, context),
        ),
    }),
    get_incident: tool({
      description: "Load one incident and its recent event history.",
      inputSchema: z.object({ id: z.string().trim().min(1) }),
      execute: async ({ id }) =>
        toolResult(
          "get_incident",
          await dependencies.incidentService.getIncidentDetail(id, context),
        ),
    }),
    list_heartbeat_monitors: tool({
      description:
        "List heartbeat monitors and their health in the current app.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).default(20),
      }),
      execute: async ({ limit }) => {
        const monitors =
          await dependencies.heartbeatService.listHeartbeatMonitors(context);
        return toolResult("list_heartbeat_monitors", {
          ...monitors,
          ...(monitors.success
            ? { data: monitors.data.monitors.slice(0, limit) }
            : {}),
        });
      },
    }),
    get_heartbeat_monitor: tool({
      description: "Load one heartbeat monitor from the current app.",
      inputSchema: z.object({ id: z.string().trim().min(1) }),
      execute: async ({ id }) => {
        const monitor = await dependencies.heartbeatService.getHeartbeatMonitor(
          id,
          context,
        );
        return toolResult("get_heartbeat_monitor", monitor);
      },
    }),
    list_alert_rules: tool({
      description:
        "List alert rules for the current app with thresholds, enabled state, destinations, and open incident counts.",
      inputSchema: z.object({}),
      execute: async () =>
        toolResult(
          "list_alert_rules",
          await dependencies.alertRuleService.getAlertRules(context),
        ),
    }),
    get_alert_rule: tool({
      description:
        "Load one alert rule from the current app, including its scope and notification destinations.",
      inputSchema: z.object({ id: z.string().trim().min(1) }),
      execute: async ({ id }) =>
        toolResult(
          "get_alert_rule",
          await dependencies.alertRuleService.getAlertRule(id, context),
        ),
    }),
  };
};

export { createChatTools };
