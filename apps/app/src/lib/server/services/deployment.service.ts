import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import { deployment } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

class DeploymentService {
  private logger: Logger;

  constructor(
    private db: DB,
    private clickhouse: ClickHouse,
    logger: Logger,
  ) {
    this.logger = logger.child("DeploymentService");
  }

  async listDeployments(
    input: z.infer<typeof listDeploymentsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("listDeployments: listing deployments", {
      input,
      context,
    });

    const validated = listDeploymentsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const whereClauses = [eq(deployment.appId, context.appId)];

      if (validated.data.serviceName) {
        whereClauses.push(
          eq(deployment.serviceName, validated.data.serviceName),
        );
      }

      if (validated.data.environmentName) {
        whereClauses.push(
          eq(deployment.environmentName, validated.data.environmentName),
        );
      }

      if (validated.data.status) {
        whereClauses.push(eq(deployment.status, validated.data.status));
      }

      if (validated.data.startAtUtc) {
        whereClauses.push(
          gte(deployment.startedAt, new Date(validated.data.startAtUtc)),
        );
      }

      if (validated.data.endAtUtc) {
        whereClauses.push(
          lte(deployment.startedAt, new Date(validated.data.endAtUtc)),
        );
      }

      const deployments = await this.db.query.deployment.findMany({
        where: and(...whereClauses),
        orderBy: [desc(deployment.startedAt)],
        limit: validated.data.limit,
      });

      return ok({ deployments });
    } catch (error) {
      this.logger.error(
        "listDeployments: failed to list deployments",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to list deployments.");
    }
  }

  async getDeployment(
    input: z.infer<typeof getDeploymentInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getDeployment: getting deployment", { input, context });

    const validated = getDeploymentInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const row = await this.db.query.deployment.findFirst({
        where: and(
          eq(deployment.id, validated.data.id),
          eq(deployment.appId, context.appId),
        ),
      });

      if (!row) {
        return err("Deployment not found.");
      }

      return ok({ deployment: row });
    } catch (error) {
      this.logger.error(
        "getDeployment: failed to get deployment",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to get deployment.");
    }
  }

  async getDeploymentHealth(
    input: z.infer<typeof getDeploymentInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getDeploymentHealth: getting deployment health", {
      input,
      context,
    });

    const deploymentResult = await this.getDeployment(input, context);
    if (!deploymentResult.success) {
      return deploymentResult;
    }

    const row = deploymentResult.data.deployment;
    const startedAt = new Date(row.startedAt);
    const beforeStart = new Date(startedAt.getTime() - releaseWindowMs);
    const afterEnd = new Date(startedAt.getTime() + releaseWindowMs);

    try {
      const [
        beforeLogs,
        afterLogs,
        beforeTraces,
        afterTraces,
        topErrors,
        slowTraces,
      ] = await Promise.all([
        this.getLogWindowSummary(
          context.appId,
          row.serviceName,
          row.environmentName,
          beforeStart,
          startedAt,
        ),
        this.getLogWindowSummary(
          context.appId,
          row.serviceName,
          row.environmentName,
          startedAt,
          afterEnd,
        ),
        this.getTraceWindowSummary(
          context.appId,
          row.serviceName,
          row.environmentName,
          beforeStart,
          startedAt,
        ),
        this.getTraceWindowSummary(
          context.appId,
          row.serviceName,
          row.environmentName,
          startedAt,
          afterEnd,
        ),
        this.getTopErrors(
          context.appId,
          row.serviceName,
          row.environmentName,
          startedAt,
          afterEnd,
        ),
        this.getSlowTraces(
          context.appId,
          row.serviceName,
          row.environmentName,
          startedAt,
          afterEnd,
        ),
      ]);

      return ok({
        deployment: row,
        windowMinutes: releaseWindowMinutes,
        before: {
          startAtUtc: beforeStart.toISOString(),
          endAtUtc: startedAt.toISOString(),
          logs: beforeLogs,
          traces: beforeTraces,
        },
        after: {
          startAtUtc: startedAt.toISOString(),
          endAtUtc: afterEnd.toISOString(),
          logs: afterLogs,
          traces: afterTraces,
        },
        topErrors,
        slowTraces,
      });
    } catch (error) {
      this.logger.error(
        "getDeploymentHealth: failed to get deployment health",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to get deployment health.");
    }
  }

  private async getLogWindowSummary(
    appId: string,
    serviceName: string,
    environmentName: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
				SELECT
					count() AS total,
					countIf(lowerUTF8(severity_text) = 'fatal' OR lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0) AS errors
				FROM logs_raw
				WHERE ${buildTelemetryWhereClause(appId, serviceName, environmentName, "timestamp", startAt, endAt)}
			`,
    });
    const [row] = (await result.json()) as unknown as RawLogSummaryRow[];

    return {
      total: Number(row?.total ?? 0),
      errors: Number(row?.errors ?? 0),
    };
  }

  private async getTraceWindowSummary(
    appId: string,
    serviceName: string,
    environmentName: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
				SELECT
					uniqExact(trace_id) AS traces,
					uniqExactIf(trace_id, status_code = 2) AS error_traces,
					quantile(0.95)(duration_ns / 1000000) AS p95_latency_ms
				FROM traces_raw
				WHERE ${buildTelemetryWhereClause(appId, serviceName, environmentName, "start_time", startAt, endAt)}
			`,
    });
    const [row] = (await result.json()) as unknown as RawTraceSummaryRow[];
    const traces = Number(row?.traces ?? 0);
    const errorTraces = Number(row?.error_traces ?? 0);

    return {
      total: traces,
      errors: errorTraces,
      errorRate: traces > 0 ? errorTraces / traces : 0,
      p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
      throughputPerMinute: traces / releaseWindowMinutes,
    };
  }

  private async getTopErrors(
    appId: string,
    serviceName: string,
    environmentName: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
				SELECT
					body,
					count() AS count,
					max(timestamp) AS last_seen_at
				FROM logs_raw
				WHERE ${buildTelemetryWhereClause(appId, serviceName, environmentName, "timestamp", startAt, endAt)}
					AND (lowerUTF8(severity_text) = 'fatal' OR lowerUTF8(severity_text) = 'error' OR positionCaseInsensitiveUTF8(severity_text, 'err') > 0)
				GROUP BY body
				ORDER BY count DESC, last_seen_at DESC
				LIMIT 5
			`,
    });
    const rows = (await result.json()) as unknown as RawTopErrorRow[];

    return rows.map((errorRow) => ({
      body: errorRow.body,
      count: Number(errorRow.count),
      lastSeenAt: normalizeDateTime(errorRow.last_seen_at),
    }));
  }

  private async getSlowTraces(
    appId: string,
    serviceName: string,
    environmentName: string,
    startAt: Date,
    endAt: Date,
  ) {
    const result = await this.clickhouse.query({
      format: "JSONEachRow",
      query: `
				SELECT
					trace_id,
					coalesce(nullIf(argMinIf(name, start_time, parent_span_id = ''), ''), argMin(name, start_time)) AS name,
					min(start_time) AS start_time,
					max(end_time) AS end_time,
					toInt64(toUnixTimestamp64Nano(max(end_time)) - toUnixTimestamp64Nano(min(start_time))) AS duration_ns,
					countIf(status_code = 2) AS error_count
				FROM traces_raw
				WHERE ${buildTelemetryWhereClause(appId, serviceName, environmentName, "start_time", startAt, endAt)}
				GROUP BY trace_id
				ORDER BY duration_ns DESC
				LIMIT 5
			`,
    });
    const rows = (await result.json()) as unknown as RawSlowTraceRow[];

    return rows.map((trace) => ({
      traceId: trace.trace_id,
      name: trace.name,
      startTime: normalizeDateTime(trace.start_time),
      endTime: normalizeDateTime(trace.end_time),
      durationNs: Number(trace.duration_ns),
      errorCount: Number(trace.error_count),
    }));
  }
}

const deploymentStatusSchema = z.enum([
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "rolled_back",
]);

const listDeploymentsInputSchema = z.object({
  serviceName: z.string().trim().min(1).max(255).optional(),
  environmentName: z.string().trim().min(1).max(255).optional(),
  status: deploymentStatusSchema.optional(),
  startAtUtc: z.string().datetime({ offset: true }).optional(),
  endAtUtc: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

const getDeploymentInputSchema = z.object({
  id: z.string().trim().min(1).max(255),
});

type RawLogSummaryRow = {
  total: number | string;
  errors: number | string;
};

type RawTraceSummaryRow = {
  traces: number | string;
  error_traces: number | string;
  p95_latency_ms: number | string;
};

type RawTopErrorRow = {
  body: string;
  count: number | string;
  last_seen_at: string | Date;
};

type RawSlowTraceRow = {
  trace_id: string;
  name: string;
  start_time: string | Date;
  end_time: string | Date;
  duration_ns: number | string;
  error_count: number | string;
};

const releaseWindowMinutes = 30;
const releaseWindowMs = releaseWindowMinutes * 60 * 1000;

const quote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) =>
  `parseDateTime64BestEffort(${quote(value.toISOString())})`;

const buildTelemetryWhereClause = (
  appId: string,
  serviceName: string,
  environmentName: string,
  timeColumn: "timestamp" | "start_time",
  startAt: Date,
  endAt: Date,
) =>
  [
    `app_id = ${quote(appId)}`,
    `service_name = ${quote(serviceName)}`,
    `deployment_environment = ${quote(environmentName)}`,
    `${timeColumn} >= ${toDateTime64(startAt)}`,
    `${timeColumn} < ${toDateTime64(endAt)}`,
  ].join(" AND ");

const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value.includes("T")) {
    return value.endsWith("Z") ? value : `${value}Z`;
  }

  return `${value.replace(" ", "T")}Z`;
};

export {
  DeploymentService,
  getDeploymentInputSchema,
  listDeploymentsInputSchema,
};
