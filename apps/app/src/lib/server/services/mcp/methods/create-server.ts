import type { AlertRuleService } from "$lib/server/services/alert-rule";
import type { AppService } from "$lib/server/services/app";
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
import {
  compactHeartbeat,
  compactIncident,
  compactToolOutput,
  compactValue,
} from "$lib/server/services/chat/tools/compact";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const defaultTime = { kind: "preset", preset: "last_hour" } as const;
const appIdSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe("Target app ID. Omit only when the organization has one app.");
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const jsonSafe = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as unknown;

const createToolResult = (
  toolName: string,
  value: { success: boolean; data?: unknown; error?: string },
) => {
  const compacted = jsonSafe(
    compactToolOutput(
      toolName,
      value.success
        ? { data: value.data }
        : { error: value.error ?? "The observability query failed." },
    ),
  );
  const structuredContent =
    compacted && typeof compacted === "object" && !Array.isArray(compacted)
      ? (compacted as Record<string, unknown>)
      : { data: compacted };
  const text = JSON.stringify(structuredContent);

  if (text.length > 80_000) {
    return {
      content: [
        {
          type: "text" as const,
          text: "The result is too large. Use narrower filters or a smaller limit.",
        },
      ],
      structuredContent: {
        error:
          "The result is too large. Use narrower filters or a smaller limit.",
      },
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
    isError: !value.success,
  };
};

const createMcpServer = (
  dependencies: {
    alertRuleService: AlertRuleService;
    appService: AppService;
    heartbeatService: HeartbeatService;
    incidentService: IncidentService;
    logsService: LogsService;
    metricsService: MetricsService;
    tracesService: TracesService;
  },
  context: { organizationId: string },
) => {
  const server = new McpServer(
    { name: "orvo", version: "1.0.0" },
    {
      instructions:
        "Read Orvo observability data for one organization. Start with list_apps, then use app IDs to investigate logs, traces, metrics, incidents, heartbeat monitors, and alert rules. Prefer narrow time windows and follow trace IDs across signals.",
    },
  );

  const resolveApp = async (appId?: string) => {
    if (appId) {
      const result = await dependencies.appService.getApp(
        { id: appId },
        { organizationId: context.organizationId },
      );
      return result.success
        ? { success: true as const, app: result.data.app }
        : { success: false as const, error: result.error };
    }

    const result = await dependencies.appService.listApps(context);
    if (!result.success)
      return { success: false as const, error: result.error };
    if (result.data.apps.length === 1) {
      return { success: true as const, app: result.data.apps[0]! };
    }
    return {
      success: false as const,
      error:
        result.data.apps.length === 0
          ? "This organization has no apps."
          : "Choose an appId from list_apps.",
    };
  };

  const withApp = async <T>(
    appId: string | undefined,
    run: (app: { id: string; name: string }) => Promise<T>,
  ) => {
    const resolved = await resolveApp(appId);
    if (!resolved.success) {
      return createToolResult("app", { success: false, error: resolved.error });
    }
    return run(resolved.app);
  };

  server.registerTool(
    "list_apps",
    {
      title: "List apps",
      description:
        "List every app in the authorized organization. Call this first when choosing an app to investigate.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await dependencies.appService.listApps(context);
      return createToolResult("list_apps", {
        ...result,
        ...(result.success
          ? {
              data: {
                apps: result.data.apps.map((app) => ({
                  id: app.id,
                  name: app.name,
                  createdAt: app.createdAt,
                })),
              },
            }
          : {}),
      });
    },
  );

  server.registerTool(
    "get_app_overview",
    {
      title: "Get app overview",
      description:
        "Summarize telemetry volume, open incidents, heartbeat health, and alert rules for an app.",
      inputSchema: z.object({
        appId: appIdSchema,
        time: timeFilterSchema.optional().default(defaultTime),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, time }) =>
      withApp(appId, async (app) => {
        const appContext = { appId: app.id };
        const [logs, traces, metrics, incidents, heartbeats, alerts] =
          await Promise.all([
            dependencies.logsService.getTotalLogs({ time }, appContext),
            dependencies.tracesService.getTotalTraces({ time }, appContext),
            dependencies.metricsService.getTotalMetrics({ time }, appContext),
            dependencies.incidentService.getOpenIncidents(
              { limit: 10 },
              appContext,
            ),
            dependencies.heartbeatService.listHeartbeatMonitors(appContext),
            dependencies.alertRuleService.getAlertRules(appContext),
          ]);
        const monitors = heartbeats.success ? heartbeats.data.monitors : [];
        const rules = alerts.success ? alerts.data.rules : [];

        return createToolResult("get_app_overview", {
          success: true,
          data: {
            app: { id: app.id, name: app.name },
            logs: logs.success ? logs.data : { error: logs.error },
            traces: traces.success ? traces.data : { error: traces.error },
            metrics: metrics.success ? metrics.data : { error: metrics.error },
            incidents: incidents.success
              ? incidents.data.incidents
                  .slice(0, 10)
                  .map((item) => compactIncident(item))
              : { error: incidents.error },
            heartbeats: heartbeats.success
              ? {
                  total: monitors.length,
                  attention: monitors
                    .filter(
                      (item) => item.status !== "healthy" || item.isPaused,
                    )
                    .slice(0, 10)
                    .map((item) => compactHeartbeat(item)),
                }
              : { error: heartbeats.error },
            alerts: alerts.success
              ? {
                  total: rules.length,
                  enabled: rules.filter((rule) => rule.isEnabled).length,
                  withOpenIncidents: rules.filter(
                    (rule) => rule.openIncidentCount > 0,
                  ).length,
                }
              : { error: alerts.error },
          },
        });
      }),
  );

  server.registerTool(
    "search_logs",
    {
      title: "Search logs",
      description:
        "Search logs by time, structured attributes, severity, service, and pagination.",
      inputSchema: getLogsInputSchema.extend({
        appId: appIdSchema,
        time: timeFilterSchema.optional().default(defaultTime),
        limit: z.number().int().min(1).max(25).default(20),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, ...input }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "search_logs",
          await dependencies.logsService.getLogs(input, { appId: app.id }),
        ),
      ),
  );

  server.registerTool(
    "get_log",
    {
      title: "Get log",
      description: "Load one log and its diagnostic attributes by log ID.",
      inputSchema: z.object({
        appId: appIdSchema,
        id: z.string().trim().min(1).max(255),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, id }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "get_log",
          await dependencies.logsService.getLogById({ id }, { appId: app.id }),
        ),
      ),
  );

  server.registerTool(
    "search_traces",
    {
      title: "Search traces",
      description:
        "Search traces by time, text, service, environment, status, duration, attributes, and pagination.",
      inputSchema: getTracesInputSchema.extend({
        appId: appIdSchema,
        time: timeFilterSchema.optional().default(defaultTime),
        limit: z.number().int().min(1).max(25).default(20),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, ...input }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "search_traces",
          await dependencies.tracesService.getTraces(input, { appId: app.id }),
        ),
      ),
  );

  server.registerTool(
    "get_trace",
    {
      title: "Get trace",
      description:
        "Load a trace by trace ID, prioritizing root, error, and slow spans while bounding very large traces.",
      inputSchema: z.object({
        appId: appIdSchema,
        id: z.string().trim().min(1).max(255),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, id }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "get_trace",
          await dependencies.tracesService.getTrace({ id }, { appId: app.id }),
        ),
      ),
  );

  server.registerTool(
    "get_service_graph",
    {
      title: "Get service graph",
      description:
        "Load the trace-derived service dependency graph for a time window.",
      inputSchema: z.object({
        appId: appIdSchema,
        time: timeFilterSchema.optional().default(defaultTime),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, time }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "get_service_graph",
          await dependencies.tracesService.getServiceGraph(
            { time },
            { appId: app.id },
          ),
        ),
      ),
  );

  server.registerTool(
    "query_metrics",
    {
      title: "Query metrics",
      description:
        "Discover metric names or query compact time series with aggregation and grouping.",
      inputSchema: getMetricsExplorerInputSchema
        .omit({ sampleLimit: true })
        .extend({
          appId: appIdSchema,
          time: timeFilterSchema.optional().default(defaultTime),
          bucketCount: z.number().int().min(10).max(60).default(30),
        }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, ...input }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "query_metrics",
          await dependencies.metricsService.getMetricsExplorer(
            { ...input, sampleLimit: 1 },
            { appId: app.id },
          ),
        ),
      ),
  );

  server.registerTool(
    "list_incidents",
    {
      title: "List incidents",
      description:
        "List incidents, optionally filtered by status, source, or entity.",
      inputSchema: z.object({
        appId: appIdSchema,
        status: incidentStatusSchema.default("all"),
        sourceType: incidentSourceTypeSchema.optional(),
        sourceId: z.string().trim().min(1).optional(),
        entityId: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(25).default(20),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, ...input }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "list_incidents",
          await dependencies.incidentService.listIncidents(input, {
            appId: app.id,
          }),
        ),
      ),
  );

  server.registerTool(
    "get_incident",
    {
      title: "Get incident",
      description: "Load one incident with its event and notification history.",
      inputSchema: z.object({
        appId: appIdSchema,
        id: z.string().trim().min(1),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, id }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "get_incident",
          await dependencies.incidentService.getIncidentDetail(id, {
            appId: app.id,
          }),
        ),
      ),
  );

  server.registerTool(
    "list_heartbeat_monitors",
    {
      title: "List heartbeat monitors",
      description: "List heartbeat monitors and their current health.",
      inputSchema: z.object({
        appId: appIdSchema,
        limit: z.number().int().min(1).max(25).default(20),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, limit }) =>
      withApp(appId, async (app) => {
        const result =
          await dependencies.heartbeatService.listHeartbeatMonitors({
            appId: app.id,
          });
        return createToolResult("list_heartbeat_monitors", {
          ...result,
          ...(result.success
            ? { data: { monitors: result.data.monitors.slice(0, limit) } }
            : {}),
        });
      }),
  );

  server.registerTool(
    "get_heartbeat_monitor",
    {
      title: "Get heartbeat monitor",
      description: "Load one heartbeat monitor and its configuration.",
      inputSchema: z.object({
        appId: appIdSchema,
        id: z.string().trim().min(1),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, id }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "get_heartbeat_monitor",
          await dependencies.heartbeatService.getHeartbeatMonitor(id, {
            appId: app.id,
          }),
        ),
      ),
  );

  server.registerTool(
    "list_alert_rules",
    {
      title: "List alert rules",
      description:
        "List alert rules with thresholds, enabled state, destinations, and open incident counts.",
      inputSchema: z.object({ appId: appIdSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId }) =>
      withApp(appId, async (app) => {
        const result = await dependencies.alertRuleService.getAlertRules({
          appId: app.id,
        });
        return createToolResult("list_alert_rules", {
          ...result,
          ...(result.success
            ? {
                data: {
                  rules: result.data.rules.map((rule) =>
                    compactValue(rule, { maxDepth: 3, maxEntries: 20 }),
                  ),
                },
              }
            : {}),
        });
      }),
  );

  server.registerTool(
    "get_alert_rule",
    {
      title: "Get alert rule",
      description:
        "Load one alert rule, including its scope and notification destinations.",
      inputSchema: z.object({
        appId: appIdSchema,
        id: z.string().trim().min(1),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ appId, id }) =>
      withApp(appId, async (app) =>
        createToolResult(
          "get_alert_rule",
          await dependencies.alertRuleService.getAlertRule(id, {
            appId: app.id,
          }),
        ),
      ),
  );

  return server;
};

export { createMcpServer };
