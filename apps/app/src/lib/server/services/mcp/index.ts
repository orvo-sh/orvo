import { Instrument } from "$lib/instrumentation";
import type { AppService } from "$lib/server/services/app";
import type { HeartbeatService } from "$lib/server/services/heartbeat";
import type { IncidentService } from "$lib/server/services/incident";
import {
  incidentSourceTypeSchema,
  incidentStatusSchema,
} from "$lib/server/services/incident";
import type { LogsService } from "$lib/server/services/logs";
import {
  logFilterConditionSchema,
  logSortBySchema,
  logSortOrderSchema,
} from "$lib/server/services/logs";
import type { MetricsService } from "$lib/server/services/metrics";
import {
  metricAggregationSchema,
  metricGroupBySchema,
} from "$lib/server/services/metrics";
import {
  resolveTimeFilter,
  timeFilterSchema,
  type TimeFilter,
} from "$lib/server/services/shared/time-filter";
import type { TracesService } from "$lib/server/services/traces";
import {
  traceFilterConditionSchema,
  traceSortBySchema,
  traceSortOrderSchema,
} from "$lib/server/services/traces";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { z } from "zod";

const defaultTimeFilter = {
  kind: "preset",
  preset: "last_hour",
} as const satisfies TimeFilter;

const textSchema = {
  type: "string",
};

const appIdJsonSchema = {
  type: "string",
  description:
    "Target app ID. Required when the token is allowed to access more than one app.",
};

const genericOutputSchema = {
  type: "object",
  properties: {
    meta: { type: "object" },
    query: { type: "object" },
    summary: { type: "object" },
    item: { type: "object" },
    items: { type: "array", items: { type: "object" } },
    page: { type: "object" },
  },
};

const timeFilterJsonSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["preset"] },
        preset: {
          type: "string",
          enum: [
            "last_30_minutes",
            "last_hour",
            "today",
            "last_4_hours",
            "last_24_hours",
            "last_3_days",
            "last_7_days",
            "last_2_weeks",
            "last_month",
          ],
          default: "last_hour",
        },
      },
      required: ["kind", "preset"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["range"] },
        start: { type: "string", format: "date-time" },
        end: { type: "string", format: "date-time" },
      },
      required: ["kind", "start", "end"],
    },
  ],
};

const withOptionalAppId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({
    appId: z.string().trim().min(1).optional(),
  });

const listAppsToolInputSchema = z.object({});

const getAppOverviewToolInputSchema = withOptionalAppId(
  z.object({
    time: timeFilterSchema.optional().default(defaultTimeFilter),
    incidentLimit: z.number().int().min(1).max(20).default(10),
    heartbeatLimit: z.number().int().min(1).max(20).default(10),
  }),
);

const searchLogsToolInputSchema = withOptionalAppId(
  z.object({
    time: timeFilterSchema.optional().default(defaultTimeFilter),
    activeFilters: z
      .array(logFilterConditionSchema)
      .max(50)
      .optional()
      .default([]),
    sortBy: logSortBySchema.default("timestamp"),
    sortOrder: logSortOrderSchema.default("desc"),
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().min(1).max(255).optional(),
  }),
);

const getLogToolInputSchema = withOptionalAppId(
  z.object({
    id: z.string().trim().min(1).max(255),
  }),
);

const searchTracesToolInputSchema = withOptionalAppId(
  z.object({
    time: timeFilterSchema.optional().default(defaultTimeFilter),
    search: z.string().trim().max(500).optional().default(""),
    services: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    environments: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    scopes: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    statuses: z
      .array(z.enum(["ok", "error"]))
      .max(10)
      .optional()
      .default([]),
    operations: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    traceIds: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    conditions: z
      .array(traceFilterConditionSchema)
      .max(50)
      .optional()
      .default([]),
    minDurationNs: z.number().min(0).optional(),
    maxDurationNs: z.number().min(0).optional(),
    sortBy: traceSortBySchema.default("start_time"),
    sortOrder: traceSortOrderSchema.default("desc"),
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().min(1).max(255).optional(),
  }),
);

const getServiceGraphToolInputSchema = withOptionalAppId(
  z.object({
    time: timeFilterSchema.optional().default(defaultTimeFilter),
  }),
);

const queryMetricsToolInputSchema = withOptionalAppId(
  z.object({
    time: timeFilterSchema.optional().default(defaultTimeFilter),
    metricName: z.string().trim().min(1).max(255).optional(),
    search: z.string().trim().max(500).optional().default(""),
    aggregation: metricAggregationSchema.default("avg"),
    groupBy: metricGroupBySchema.default("none"),
    services: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    environments: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    containers: z
      .array(z.string().trim().min(1).max(255))
      .max(50)
      .optional()
      .default([]),
    entityKinds: z
      .array(z.enum(["application", "container"]))
      .max(10)
      .optional()
      .default([]),
    bucketCount: z.number().int().min(10).max(120).default(60),
    sampleLimit: z.number().int().min(1).max(50).default(25),
  }),
);

const listIncidentsToolInputSchema = withOptionalAppId(
  z.object({
    status: incidentStatusSchema.default("all"),
    sourceType: incidentSourceTypeSchema.optional(),
    sourceId: z.string().trim().min(1).optional(),
    entityId: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
);

const getIncidentToolInputSchema = withOptionalAppId(
  z.object({
    id: z.string().trim().min(1),
  }),
);

const listHeartbeatMonitorsToolInputSchema = withOptionalAppId(
  z.object({
    limit: z.number().int().min(1).max(100).default(50),
  }),
);

const getHeartbeatMonitorToolInputSchema = withOptionalAppId(
  z.object({
    id: z.string().trim().min(1),
  }),
);

const hasScopes = (grantedScopes: string[], requiredScopes: string[]) =>
  requiredScopes.every((scope) => grantedScopes.includes(scope));

const normalizeTime = (time: TimeFilter) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(time);

  return {
    kind: time.kind,
    preset: time.kind === "preset" ? time.preset : null,
    from: startAtUtc.toISOString(),
    to: endAtUtc.toISOString(),
  };
};

const truncateText = (value: string | null | undefined, maxLength = 4096) =>
  typeof value === "string" && value.length > maxLength
    ? `${value.slice(0, maxLength)}…`
    : (value ?? null);

const sanitizeLog = (log: Record<string, unknown>) => ({
  ...log,
  body: truncateText(typeof log.body === "string" ? log.body : null),
});

const sanitizeHeartbeatMonitor = (monitor: Record<string, unknown>) => {
  const rest = { ...monitor };
  delete rest.token;
  delete rest.url;
  delete rest.secretUrl;
  return rest;
};

type McpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  requiredScopes: string[];
  schema: z.ZodTypeAny;
  execute: (input: any) => Promise<any>;
};

@Instrument({ prefix: "mcp" })
class McpService {
  private logger: Logger;

  constructor(
    logger: Logger,
    private appService: AppService,
    private logsService: LogsService,
    private tracesService: TracesService,
    private metricsService: MetricsService,
    private incidentService: IncidentService,
    private heartbeatService: HeartbeatService,
  ) {
    this.logger = logger.child("McpService");
  }

  async listTools(context: {
    organizationId: string;
    allowedAppIds: string[];
    scopes: string[];
  }) {
    return {
      tools: this.getToolDefinitions(context)
        .filter((tool) => hasScopes(context.scopes, tool.requiredScopes))
        .map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        })),
    };
  }

  async callTool(
    name: string,
    args: unknown,
    context: {
      organizationId: string;
      allowedAppIds: string[];
      scopes: string[];
    },
  ) {
    const tool = this.getToolDefinitions(context).find(
      (entry) => entry.name === name,
    );

    if (!tool) {
      return null;
    }

    if (!hasScopes(context.scopes, tool.requiredScopes)) {
      return {
        content: [
          {
            type: "text",
            text: `Missing required scopes for ${name}: ${tool.requiredScopes.join(", ")}`,
          },
        ],
        structuredContent: {
          error: {
            message: "Missing required scopes.",
            requiredScopes: tool.requiredScopes,
          },
        },
        isError: true,
      };
    }

    const validated = tool.schema.safeParse(args ?? {});

    if (!validated.success) {
      return {
        content: [{ type: "text", text: validated.error.message }],
        structuredContent: {
          error: {
            message: "Invalid tool input.",
            issues: validated.error.issues,
          },
        },
        isError: true,
      };
    }

    return tool.execute(validated.data);
  }

  private getToolDefinitions(context: {
    organizationId: string;
    allowedAppIds: string[];
    scopes: string[];
  }): McpToolDefinition[] {
    const buildEnvelope = (
      payload: {
        app?: { id: string; name: string } | null;
        item?: Record<string, unknown> | null;
        items?: Array<Record<string, unknown>>;
        query?: Record<string, unknown>;
        summary?: Record<string, unknown>;
        page?: Record<string, unknown> | null;
      },
      text: string,
    ) => ({
      content: [{ type: "text", text }],
      structuredContent: {
        meta: {
          app: payload.app ?? null,
          requestId: genId("mcp"),
          generatedAt: new Date().toISOString(),
          scope: context.scopes,
          allowedAppIds: context.allowedAppIds,
        },
        ...(payload.query ? { query: payload.query } : {}),
        ...(payload.summary ? { summary: payload.summary } : {}),
        ...(payload.item !== undefined ? { item: payload.item } : {}),
        ...(payload.items !== undefined ? { items: payload.items } : {}),
        ...(payload.page ? { page: payload.page } : {}),
      },
    });

    const resolveAllowedApps = async () => {
      const appsResult = await this.appService.listApps({
        organizationId: context.organizationId,
      });

      if (!appsResult.success) {
        return appsResult;
      }

      return {
        success: true as const,
        data: {
          apps: appsResult.data.apps.filter((app) =>
            context.allowedAppIds.includes(app.id),
          ),
        },
      };
    };

    const resolveTargetApp = async (appId?: string) => {
      if (context.allowedAppIds.length === 0) {
        return {
          success: false as const,
          error: "This MCP token does not allow access to any apps.",
        };
      }

      const targetAppId =
        appId && appId.length > 0
          ? appId
          : context.allowedAppIds.length === 1
            ? context.allowedAppIds[0]
            : null;

      if (!targetAppId) {
        return {
          success: false as const,
          error: "Choose an appId. This token allows more than one app.",
        };
      }

      if (!context.allowedAppIds.includes(targetAppId)) {
        return {
          success: false as const,
          error: "This MCP token is not allowed to access that app.",
        };
      }

      const appResult = await this.appService.getApp(
        { id: targetAppId },
        { organizationId: context.organizationId },
      );

      if (!appResult.success) {
        return appResult;
      }

      return {
        success: true as const,
        data: {
          appId: targetAppId,
          app: appResult.data.app,
        },
      };
    };

    return [
      {
        name: "list_apps",
        title: "List apps",
        description: "List the apps this MCP token is allowed to access.",
        inputSchema: {
          type: "object",
          properties: {},
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["app:read"],
        schema: listAppsToolInputSchema,
        execute: async () => {
          const appsResult = await resolveAllowedApps();

          if (!appsResult.success) {
            return {
              content: [{ type: "text", text: appsResult.error }],
              structuredContent: { error: { message: appsResult.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              summary: {
                total: appsResult.data.apps.length,
              },
              items: appsResult.data.apps as unknown as Array<
                Record<string, unknown>
              >,
            },
            `This token can access ${appsResult.data.apps.length} app${appsResult.data.apps.length === 1 ? "" : "s"}.`,
          );
        },
      },
      {
        name: "get_app_overview",
        title: "Get app overview",
        description:
          "Get a compact app summary with activity totals, recent incidents, and heartbeat health for one allowed app.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            time: timeFilterJsonSchema,
            incidentLimit: {
              type: "number",
              default: 10,
              minimum: 1,
              maximum: 20,
            },
            heartbeatLimit: {
              type: "number",
              default: 10,
              minimum: 1,
              maximum: 20,
            },
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["app:read"],
        schema: getAppOverviewToolInputSchema,
        execute: async (
          input: z.infer<typeof getAppOverviewToolInputSchema>,
        ) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const [
            logsTotal,
            tracesTotal,
            metricsTotal,
            incidentsResult,
            heartbeatsResult,
          ] = await Promise.all([
            hasScopes(context.scopes, ["logs:read"])
              ? this.logsService.getTotalLogs(
                  { time: input.time },
                  { appId: appContext.data.appId },
                )
              : Promise.resolve(null),
            hasScopes(context.scopes, ["traces:read"])
              ? this.tracesService.getTotalTraces(
                  { time: input.time },
                  { appId: appContext.data.appId },
                )
              : Promise.resolve(null),
            hasScopes(context.scopes, ["metrics:read"])
              ? this.metricsService.getTotalMetrics(
                  { time: input.time },
                  { appId: appContext.data.appId },
                )
              : Promise.resolve(null),
            hasScopes(context.scopes, ["incidents:read"])
              ? this.incidentService.getOpenIncidents(
                  { limit: input.incidentLimit },
                  { appId: appContext.data.appId },
                )
              : Promise.resolve(null),
            hasScopes(context.scopes, ["heartbeats:read"])
              ? this.heartbeatService.listHeartbeatMonitors({
                  appId: appContext.data.appId,
                })
              : Promise.resolve(null),
          ]);

          const incidents =
            incidentsResult && incidentsResult.success
              ? incidentsResult.data.incidents
              : [];
          const heartbeatMonitors =
            heartbeatsResult && heartbeatsResult.success
              ? heartbeatsResult.data.monitors.map((monitor) =>
                  sanitizeHeartbeatMonitor(
                    monitor as unknown as Record<string, unknown>,
                  ),
                )
              : [];

          const heartbeatSummary = heartbeatMonitors.reduce(
            (summary, monitor) => {
              const status =
                typeof monitor.status === "string" ? monitor.status : "unknown";
              summary[status] = Number(summary[status] ?? 0) + 1;
              return summary;
            },
            {} as Record<string, number>,
          );

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                appId: appContext.data.appId,
                time: normalizeTime(input.time),
              },
              summary: {
                logsTotal:
                  logsTotal && logsTotal.success ? logsTotal.data.total : null,
                tracesTotal:
                  tracesTotal && tracesTotal.success
                    ? tracesTotal.data.total
                    : null,
                metricsTotal:
                  metricsTotal && metricsTotal.success
                    ? metricsTotal.data.total
                    : null,
                openIncidentCount: incidents.length,
                heartbeatMonitorCount: heartbeatMonitors.length,
                heartbeatSummary,
              },
              item: {
                openIncidents: incidents.slice(0, input.incidentLimit),
                heartbeatMonitors: heartbeatMonitors.slice(
                  0,
                  input.heartbeatLimit,
                ),
              },
            },
            `Overview for ${appContext.data.app.name}: ${incidents.length} open incidents and ${heartbeatMonitors.length} heartbeat monitors in scope.`,
          );
        },
      },
      {
        name: "search_logs",
        title: "Search logs",
        description:
          "Search logs for one allowed app with time filters, attribute filters, sort order, and pagination.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            time: timeFilterJsonSchema,
            activeFilters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  attribute: textSchema,
                  operator: {
                    type: "string",
                    enum: [
                      "eq",
                      "neq",
                      "contains",
                      "not_contains",
                      "in",
                      "not_in",
                    ],
                  },
                  value: textSchema,
                },
                required: ["attribute", "operator", "value"],
              },
            },
            sortBy: {
              type: "string",
              enum: ["timestamp", "severity", "service"],
              default: "timestamp",
            },
            sortOrder: {
              type: "string",
              enum: ["desc", "asc"],
              default: "desc",
            },
            limit: { type: "number", default: 50, minimum: 1, maximum: 100 },
            cursor: textSchema,
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["logs:read"],
        schema: searchLogsToolInputSchema,
        execute: async (input: z.infer<typeof searchLogsToolInputSchema>) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.logsService.getLogs(
            {
              time: input.time,
              activeFilters: input.activeFilters,
              sortBy: input.sortBy,
              sortOrder: input.sortOrder,
              limit: input.limit,
              cursor: input.cursor,
            },
            { appId: appContext.data.appId },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          const logs = result.data.logs.map((log) =>
            sanitizeLog(log as unknown as Record<string, unknown>),
          );

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                ...input,
                appId: appContext.data.appId,
                time: normalizeTime(input.time),
              },
              summary: {
                total: logs.length,
                hasMore: result.data.nextCursor !== null,
              },
              items: logs,
              page: {
                nextCursor: result.data.nextCursor,
              },
            },
            `Found ${logs.length} logs in ${appContext.data.app.name}.`,
          );
        },
      },
      {
        name: "get_log",
        title: "Get log",
        description: "Fetch one log event by ID for one allowed app.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            id: textSchema,
          },
          required: ["id"],
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["logs:read"],
        schema: getLogToolInputSchema,
        execute: async (input: z.infer<typeof getLogToolInputSchema>) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.logsService.getLogById(
            { id: input.id },
            { appId: appContext.data.appId },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          const log = result.data.log
            ? sanitizeLog(result.data.log as unknown as Record<string, unknown>)
            : null;

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                appId: appContext.data.appId,
                id: input.id,
              },
              item: log,
            },
            log ? `Loaded log ${input.id}.` : `No log found for ${input.id}.`,
          );
        },
      },
      {
        name: "search_traces",
        title: "Search traces",
        description:
          "Search traces for one allowed app with filters, sort order, and pagination.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            time: timeFilterJsonSchema,
            search: textSchema,
            services: { type: "array", items: textSchema },
            environments: { type: "array", items: textSchema },
            scopes: { type: "array", items: textSchema },
            statuses: {
              type: "array",
              items: { type: "string", enum: ["ok", "error"] },
            },
            operations: { type: "array", items: textSchema },
            traceIds: { type: "array", items: textSchema },
            conditions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  attribute: textSchema,
                  operator: {
                    type: "string",
                    enum: [
                      "eq",
                      "neq",
                      "contains",
                      "not_contains",
                      "in",
                      "not_in",
                      "gt",
                      "gte",
                      "lt",
                      "lte",
                    ],
                  },
                  value: textSchema,
                },
                required: ["attribute", "operator", "value"],
              },
            },
            minDurationNs: { type: "number" },
            maxDurationNs: { type: "number" },
            sortBy: {
              type: "string",
              enum: ["start_time", "duration", "span_count", "trace_name"],
              default: "start_time",
            },
            sortOrder: {
              type: "string",
              enum: ["desc", "asc"],
              default: "desc",
            },
            limit: { type: "number", default: 50, minimum: 1, maximum: 100 },
            cursor: textSchema,
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["traces:read"],
        schema: searchTracesToolInputSchema,
        execute: async (input: z.infer<typeof searchTracesToolInputSchema>) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.tracesService.getTraces(
            {
              time: input.time,
              search: input.search,
              services: input.services,
              environments: input.environments,
              scopes: input.scopes,
              statuses: input.statuses,
              operations: input.operations,
              traceIds: input.traceIds,
              conditions: input.conditions,
              minDurationNs: input.minDurationNs,
              maxDurationNs: input.maxDurationNs,
              sortBy: input.sortBy,
              sortOrder: input.sortOrder,
              limit: input.limit,
              cursor: input.cursor,
            },
            { appId: appContext.data.appId },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                ...input,
                appId: appContext.data.appId,
                time: normalizeTime(input.time),
              },
              summary: {
                total: result.data.traces.length,
                hasMore: result.data.nextCursor !== null,
              },
              items: result.data.traces as unknown as Array<
                Record<string, unknown>
              >,
              page: {
                nextCursor: result.data.nextCursor,
              },
            },
            `Found ${result.data.traces.length} traces in ${appContext.data.app.name}.`,
          );
        },
      },
      {
        name: "get_service_graph",
        title: "Get service graph",
        description:
          "Get the trace-derived service graph for one allowed app over a selected time window.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            time: timeFilterJsonSchema,
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["traces:read"],
        schema: getServiceGraphToolInputSchema,
        execute: async (
          input: z.infer<typeof getServiceGraphToolInputSchema>,
        ) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.tracesService.getServiceGraph(
            { time: input.time },
            { appId: appContext.data.appId },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                appId: appContext.data.appId,
                time: normalizeTime(input.time),
              },
              summary: {
                nodeCount: result.data.nodes.length,
                edgeCount: result.data.edges.length,
              },
              item: result.data as unknown as Record<string, unknown>,
            },
            `Service graph for ${appContext.data.app.name} contains ${result.data.nodes.length} services and ${result.data.edges.length} edges.`,
          );
        },
      },
      {
        name: "query_metrics",
        title: "Query metrics",
        description:
          "Query metrics for one allowed app and return series, summary facets, catalog entries, and recent samples.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            time: timeFilterJsonSchema,
            metricName: textSchema,
            search: textSchema,
            aggregation: {
              type: "string",
              enum: [
                "p50",
                "p95",
                "p99",
                "avg",
                "min",
                "max",
                "count",
                "rate_per_sec",
                "rate_per_min",
                "increase",
                "total",
                "current",
              ],
              default: "avg",
            },
            groupBy: {
              type: "string",
              enum: ["none", "metric", "service", "environment"],
              default: "none",
            },
            services: { type: "array", items: textSchema },
            environments: { type: "array", items: textSchema },
            containers: { type: "array", items: textSchema },
            entityKinds: {
              type: "array",
              items: { type: "string", enum: ["application", "container"] },
            },
            bucketCount: {
              type: "number",
              default: 60,
              minimum: 10,
              maximum: 120,
            },
            sampleLimit: {
              type: "number",
              default: 25,
              minimum: 1,
              maximum: 50,
            },
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["metrics:read"],
        schema: queryMetricsToolInputSchema,
        execute: async (input: z.infer<typeof queryMetricsToolInputSchema>) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.metricsService.getMetricsExplorer(
            {
              time: input.time,
              metricName: input.metricName,
              search: input.search,
              aggregation: input.aggregation,
              groupBy: input.groupBy,
              services: input.services,
              environments: input.environments,
              containers: input.containers,
              entityKinds: input.entityKinds,
              bucketCount: input.bucketCount,
              sampleLimit: input.sampleLimit,
            },
            { appId: appContext.data.appId },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                ...input,
                appId: appContext.data.appId,
                time: normalizeTime(input.time),
              },
              summary: result.data.summary as unknown as Record<
                string,
                unknown
              >,
              item: result.data as unknown as Record<string, unknown>,
            },
            `Metrics query for ${appContext.data.app.name} returned ${result.data.summary.metricCount} metrics and ${result.data.samples.length} recent samples.`,
          );
        },
      },
      {
        name: "list_incidents",
        title: "List incidents",
        description:
          "List incidents for one allowed app with status and source filters.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            status: {
              type: "string",
              enum: ["all", "open", "resolved", "dismissed"],
              default: "all",
            },
            sourceType: { type: "string", enum: ["alert", "heartbeat"] },
            sourceId: textSchema,
            entityId: textSchema,
            limit: { type: "number", default: 50, minimum: 1, maximum: 100 },
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["incidents:read"],
        schema: listIncidentsToolInputSchema,
        execute: async (
          input: z.infer<typeof listIncidentsToolInputSchema>,
        ) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.incidentService.listIncidents(
            {
              status: input.status,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              entityId: input.entityId,
              limit: input.limit,
            },
            { appId: appContext.data.appId },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                ...input,
                appId: appContext.data.appId,
              },
              summary: {
                total: result.data.incidents.length,
              },
              items: result.data.incidents as unknown as Array<
                Record<string, unknown>
              >,
            },
            `Found ${result.data.incidents.length} incidents in ${appContext.data.app.name}.`,
          );
        },
      },
      {
        name: "get_incident",
        title: "Get incident",
        description:
          "Fetch one incident with its event history and notification deliveries for one allowed app.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            id: textSchema,
          },
          required: ["id"],
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["incidents:read"],
        schema: getIncidentToolInputSchema,
        execute: async (input: z.infer<typeof getIncidentToolInputSchema>) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.incidentService.getIncidentDetail(
            input.id,
            {
              appId: appContext.data.appId,
            },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                appId: appContext.data.appId,
                id: input.id,
              },
              item: result.data as unknown as Record<string, unknown>,
            },
            `Loaded incident ${input.id}.`,
          );
        },
      },
      {
        name: "list_heartbeat_monitors",
        title: "List heartbeat monitors",
        description:
          "List heartbeat monitors for one allowed app without exposing secret URLs or tokens.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            limit: { type: "number", default: 50, minimum: 1, maximum: 100 },
          },
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["heartbeats:read"],
        schema: listHeartbeatMonitorsToolInputSchema,
        execute: async (
          input: z.infer<typeof listHeartbeatMonitorsToolInputSchema>,
        ) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.heartbeatService.listHeartbeatMonitors({
            appId: appContext.data.appId,
          });

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          const monitors = result.data.monitors
            .map((monitor) =>
              sanitizeHeartbeatMonitor(
                monitor as unknown as Record<string, unknown>,
              ),
            )
            .slice(0, input.limit);

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                appId: appContext.data.appId,
                limit: input.limit,
              },
              summary: {
                total: monitors.length,
              },
              items: monitors,
            },
            `Loaded ${monitors.length} heartbeat monitors in ${appContext.data.app.name}.`,
          );
        },
      },
      {
        name: "get_heartbeat_monitor",
        title: "Get heartbeat monitor",
        description:
          "Fetch one heartbeat monitor for one allowed app without exposing its secret URL or token.",
        inputSchema: {
          type: "object",
          properties: {
            appId: appIdJsonSchema,
            id: textSchema,
          },
          required: ["id"],
        },
        outputSchema: genericOutputSchema,
        requiredScopes: ["heartbeats:read"],
        schema: getHeartbeatMonitorToolInputSchema,
        execute: async (
          input: z.infer<typeof getHeartbeatMonitorToolInputSchema>,
        ) => {
          const appContext = await resolveTargetApp(input.appId);

          if (!appContext.success) {
            return {
              content: [{ type: "text", text: appContext.error }],
              structuredContent: { error: { message: appContext.error } },
              isError: true,
            };
          }

          const result = await this.heartbeatService.getHeartbeatMonitor(
            input.id,
            {
              appId: appContext.data.appId,
            },
          );

          if (!result.success) {
            return {
              content: [{ type: "text", text: result.error }],
              structuredContent: { error: { message: result.error } },
              isError: true,
            };
          }

          return buildEnvelope(
            {
              app: {
                id: appContext.data.app.id,
                name: appContext.data.app.name,
              },
              query: {
                appId: appContext.data.appId,
                id: input.id,
              },
              item: sanitizeHeartbeatMonitor(
                result.data.monitor as unknown as Record<string, unknown>,
              ),
            },
            `Loaded heartbeat monitor ${input.id}.`,
          );
        },
      },
    ];
  }
}

export { McpService };
