import type { DashboardService } from "$lib/server/services/dashboard";
import {
  dashboardIdInputSchema,
  dashboardPanelDataInputSchema,
} from "$lib/server/services/dashboard";
import type { AlertRuleService } from "$lib/server/services/alert-rule";
import {
  createAlertRuleInputSchema,
  setAlertRuleEnabledInputSchema,
  updateAlertRuleInputSchema,
} from "$lib/server/services/alert-rule";
import type { AppService } from "$lib/server/services/app";
import { updateAppInputSchema } from "$lib/server/services/app";
import type { NotificationDestinationService } from "$lib/server/services/notification-destination";
import type { HeartbeatService } from "$lib/server/services/heartbeat";
import {
  createHeartbeatMonitorsInputSchema,
  updateHeartbeatMonitorInputSchema,
} from "$lib/server/services/heartbeat";
import type { IncidentService } from "$lib/server/services/incident";
import {
  dismissIncidentInputSchema,
  incidentSourceTypeSchema,
  incidentStatusSchema,
} from "$lib/server/services/incident";
import type { LogsService } from "$lib/server/services/logs";
import { getLogsInputSchema } from "$lib/server/services/logs";
import type { MetricsService } from "$lib/server/services/metrics";
import {
  getAlertMetricOptionsInputSchema,
  getMetricsExplorerInputSchema,
} from "$lib/server/services/metrics";
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

const intentSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .describe(
    "A short sentence-case description of what you are looking for or trying to achieve with this call.",
  );

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
    dashboardService: DashboardService;
    alertRuleService: AlertRuleService;
    appService: AppService;
    logsService: LogsService;
    tracesService: TracesService;
    metricsService: MetricsService;
    incidentService: IncidentService;
    heartbeatService: HeartbeatService;
    notificationDestinationService: NotificationDestinationService;
  },
  context: { appId: string; organizationId: string; userId: string },
) => {
  const withinOutputBudget = createToolOutputBudget();
  const toolResult = (
    toolName: string,
    value: { success: boolean; data?: unknown; error?: string },
  ) => withinOutputBudget(result(toolName, value));

  return {
    list_dashboards: tool({
      description: "List saved dashboards in the current app.",
      inputSchema: z.object({ intent: intentSchema }),
      execute: async () =>
        toolResult(
          "list_dashboards",
          await dependencies.dashboardService.getDashboards(context),
        ),
    }),
    get_dashboard: tool({
      description:
        "Read a saved dashboard. When a live editor is connected, its unsaved form is authoritative instead.",
      inputSchema: dashboardIdInputSchema.extend({ intent: intentSchema }),
      execute: async (input) =>
        toolResult(
          "get_dashboard",
          await dependencies.dashboardService.getDashboard(input, context),
        ),
    }),
    query_dashboard_panel: tool({
      description:
        "Query a panel configuration against this app's real data. For Scout usage choose source traces and input_tokens, output_tokens or total_tokens; these sum per-call token attributes. Tokens are never averaged. Group by model or provider for a breakdown. An empty result means no matching telemetry. Use preview_dashboard_panel for live visible panels.",
      inputSchema: dashboardPanelDataInputSchema.extend({
        intent: intentSchema,
      }),
      execute: async (input) =>
        toolResult(
          "query_dashboard_panel",
          await dependencies.dashboardService.getPanelData(input, context),
        ),
    }),
    get_app_overview: tool({
      description:
        "Summarize telemetry volume, open incidents, heartbeat health, and alert rules for the current app.",
      inputSchema: z.object({
        intent: intentSchema,
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
        intent: intentSchema,
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
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1).max(255),
      }),
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
        intent: intentSchema,
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
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1).max(255),
      }),
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
        intent: intentSchema,
        time: timeFilterSchema.optional().default(defaultTime),
      }),
      execute: async (input) =>
        toolResult(
          "get_service_graph",
          await dependencies.tracesService.getServiceGraph(input, context),
        ),
    }),
    get_alert_metric_options: tool({
      description:
        "Find available alert metrics and their type, unit, and aggregation metadata, or discover service/environment/attribute filter values. Use actual metric names including $request.* for derived metrics.",
      inputSchema: getAlertMetricOptionsInputSchema.extend({
        intent: intentSchema,
      }),
      execute: async (input) =>
        toolResult(
          "get_alert_metric_options",
          await dependencies.metricsService.getAlertMetricOptions(
            input,
            context,
          ),
        ),
    }),
    query_metrics: tool({
      description:
        "Query the metric catalog or compact time series for the current app.",
      inputSchema: getMetricsExplorerInputSchema
        .omit({ sampleLimit: true })
        .extend({
          intent: intentSchema,
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
        intent: intentSchema,
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
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "get_incident",
          await dependencies.incidentService.getIncidentDetail(id, context),
        ),
    }),
    list_notification_destinations: tool({
      description:
        "List the current app's notification destinations to reuse for heartbeat or alert notifications. Returns IDs, names, and types without secret credentials or webhook URLs. Read before proposing a destination; do not invent recipients.",
      inputSchema: z.object({ intent: intentSchema }),
      execute: async () => {
        const destinations =
          await dependencies.notificationDestinationService.listNotificationDestinations(
            context,
          );
        return toolResult(
          "list_notification_destinations",
          destinations.success
            ? {
                success: true,
                data: destinations.data.destinations.map((destination) => ({
                  id: destination.id,
                  name: destination.name,
                  kind: destination.kind,
                  isEnabled: destination.isEnabled,
                })),
              }
            : destinations,
        );
      },
    }),
    list_heartbeat_monitors: tool({
      description:
        "List heartbeat monitors and their health in the current app.",
      inputSchema: z.object({
        intent: intentSchema,
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
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) => {
        const monitor = await dependencies.heartbeatService.getHeartbeatMonitor(
          id,
          context,
        );
        return toolResult("get_heartbeat_monitor", monitor);
      },
    }),
    get_heartbeat_check_in_history: tool({
      description:
        "Read a heartbeat's latest thirty configured check-in intervals and its latest sixty actual check-ins. Includes received, pending, grace, and missed windows. These windows describe a bounded history, not lifetime reliability. Use timestamps and counts as evidence; do not infer a cause from a gap alone.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "get_heartbeat_check_in_history",
          await dependencies.heartbeatService.getHeartbeatCheckInHistory(
            id,
            context,
          ),
        ),
    }),
    list_alert_rules: tool({
      description:
        "List alert rules for the current app with thresholds, enabled state, destinations, and open incident counts.",
      inputSchema: z.object({ intent: intentSchema }),
      execute: async () =>
        toolResult(
          "list_alert_rules",
          await dependencies.alertRuleService.getAlertRules(context),
        ),
    }),
    get_alert_rule: tool({
      description:
        "Load one alert rule from the current app, including its scope and notification destinations.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "get_alert_rule",
          await dependencies.alertRuleService.getAlertRule(id, context),
        ),
    }),
    update_app: tool({
      description: "Rename the current app.",
      inputSchema: updateAppInputSchema
        .omit({ id: true, logo: true })
        .extend({ intent: intentSchema }),
      execute: async (input) =>
        toolResult(
          "update_app",
          await dependencies.appService.updateApp(
            { id: context.appId, ...input },
            context,
          ),
        ),
    }),
    create_alert_rule: tool({
      description: "Create an alert rule for the current app.",
      inputSchema: createAlertRuleInputSchema.extend({ intent: intentSchema }),
      execute: async (input) =>
        toolResult(
          "create_alert_rule",
          await dependencies.alertRuleService.createAlertRule(input, context),
        ),
    }),
    update_alert_rule: tool({
      description: "Update an alert rule in the current app.",
      inputSchema: updateAlertRuleInputSchema.extend({ intent: intentSchema }),
      execute: async (input) =>
        toolResult(
          "update_alert_rule",
          await dependencies.alertRuleService.updateAlertRule(input, context),
        ),
    }),
    set_alert_rule_enabled: tool({
      description: "Enable or disable an alert rule in the current app.",
      inputSchema: setAlertRuleEnabledInputSchema.extend({
        intent: intentSchema,
      }),
      execute: async (input) =>
        toolResult(
          "set_alert_rule_enabled",
          await dependencies.alertRuleService.setAlertRuleEnabled(
            input,
            context,
          ),
        ),
    }),
    delete_alert_rule: tool({
      description: "Permanently delete an alert rule from the current app.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "delete_alert_rule",
          await dependencies.alertRuleService.deleteAlertRule(id, context),
        ),
    }),
    create_heartbeat_monitor: tool({
      description:
        "Create one or more heartbeat monitors for the current app in one atomic bulk action. Always include every requested monitor in the monitors array instead of calling this tool repeatedly.",
      inputSchema: createHeartbeatMonitorsInputSchema.extend({
        intent: intentSchema,
      }),
      execute: async (input) =>
        toolResult(
          "create_heartbeat_monitor",
          await dependencies.heartbeatService.createHeartbeatMonitors(
            input,
            context,
          ),
        ),
    }),
    update_heartbeat_monitor: tool({
      description:
        "Edit a heartbeat's name, interval, grace period, or notification destinations. Omitted fields are preserved from its current saved state. Read the monitor and available destinations before changing notifications; destinationIds replaces the selected list, so include existing IDs when adding another destination. Call this tool directly for a clear edit request; it opens the built-in approval flow, then saves and refreshes the heartbeat page. Do not ask for preliminary approval in chat.",
      inputSchema: updateHeartbeatMonitorInputSchema.partial().extend({
        id: updateHeartbeatMonitorInputSchema.shape.id,
        destinationIds: updateHeartbeatMonitorInputSchema.shape.destinationIds
          .removeDefault()
          .optional(),
        intent: intentSchema,
      }),
      execute: async (input) => {
        const current = await dependencies.heartbeatService.getHeartbeatMonitor(
          input.id,
          context,
        );
        if (!current.success)
          return toolResult("update_heartbeat_monitor", current);
        const monitor = current.data.monitor;
        return toolResult(
          "update_heartbeat_monitor",
          await dependencies.heartbeatService.updateHeartbeatMonitor(
            {
              id: input.id,
              name: input.name ?? monitor.name,
              expectedEverySeconds:
                input.expectedEverySeconds ?? monitor.expectedEverySeconds,
              graceSeconds: input.graceSeconds ?? monitor.graceSeconds,
              destinationIds: input.destinationIds ?? monitor.destinationIds,
            },
            context,
          ),
        );
      },
    }),
    toggle_heartbeat_monitor_paused: tool({
      description: "Pause or resume a heartbeat monitor in the current app.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "toggle_heartbeat_monitor_paused",
          await dependencies.heartbeatService.toggleHeartbeatMonitorPaused(
            id,
            context,
          ),
        ),
    }),
    regenerate_heartbeat_monitor_secret: tool({
      description:
        "Regenerate a heartbeat monitor secret, invalidating its existing check-in URL.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "regenerate_heartbeat_monitor_secret",
          await dependencies.heartbeatService.regenerateHeartbeatMonitorSecret(
            id,
            context,
          ),
        ),
    }),
    send_heartbeat_monitor_test_alert: tool({
      description: "Send a test alert for a heartbeat monitor.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "send_heartbeat_monitor_test_alert",
          await dependencies.heartbeatService.sendHeartbeatMonitorTestAlert(
            id,
            context,
          ),
        ),
    }),
    delete_heartbeat_monitor: tool({
      description:
        "Permanently delete a heartbeat monitor from the current app.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "delete_heartbeat_monitor",
          await dependencies.heartbeatService.deleteHeartbeatMonitor(
            id,
            context,
          ),
        ),
    }),
    resolve_incident: tool({
      description: "Resolve an open incident in the current app.",
      inputSchema: z.object({
        intent: intentSchema,
        id: z.string().trim().min(1),
      }),
      execute: async ({ id }) =>
        toolResult(
          "resolve_incident",
          await dependencies.incidentService.resolveIncident(id, context),
        ),
    }),
    dismiss_incident: tool({
      description: "Dismiss an incident in the current app with a reason.",
      inputSchema: dismissIncidentInputSchema.extend({ intent: intentSchema }),
      execute: async (input) =>
        toolResult(
          "dismiss_incident",
          await dependencies.incidentService.dismissIncident(input, context),
        ),
    }),
  };
};

export { createChatTools };
