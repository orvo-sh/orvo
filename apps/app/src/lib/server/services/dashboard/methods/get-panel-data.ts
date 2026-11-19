import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";
import {
  createQueryBindings,
  normalizeDateTime,
} from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import { resolveAggregationExpression } from "../../metrics/shared";
import { dashboardPanelDataInputSchema } from "../schema";

const createGetPanelData =
  ({ clickhouse, logger }: { clickhouse: ClickHouse; logger: Logger }) =>
  async (
    input: z.input<typeof dashboardPanelDataInputSchema>,
    context: { appId: string },
  ) => {
    const validated = dashboardPanelDataInputSchema.safeParse(input);
    if (!validated.success) return err("Invalid panel query.");
    const { panel, timeRange } = validated.data;
    const empty = {
      series: [] as {
        name: string;
        value: number | null;
        buckets: { time: string; value: number | null }[];
      }[],
      logs: [] as {
        time: string;
        service: string;
        severity: string;
        message: string;
      }[],
      unit: "",
    };
    if (panel.visualization === "text") return ok(empty);
    try {
      const { startAtUtc, endAtUtc } = resolveTimeFilter({
        kind: "preset",
        preset: timeRange,
      });
      const bindings = createQueryBindings();
      const table =
        panel.source === "traces"
          ? "traces_raw"
          : panel.source === "metrics"
            ? "metrics_raw"
            : "logs_raw";
      const timeColumn =
        panel.source === "traces"
          ? "start_time"
          : panel.source === "metrics"
            ? "time"
            : "timestamp";
      const where = [
        `app_id = ${bindings.bindString("app_id", context.appId)}`,
        `${timeColumn} >= ${bindings.bindDateTime64("start", startAtUtc)}`,
        `${timeColumn} <= ${bindings.bindDateTime64("end", endAtUtc)}`,
      ];
      if (panel.service)
        where.push(
          `service_name = ${bindings.bindString("service", panel.service)}`,
        );
      if (panel.environment)
        where.push(
          `deployment_environment = ${bindings.bindString("environment", panel.environment)}`,
        );
      if (panel.source === "metrics")
        where.push(
          `metric_name = ${bindings.bindString("metric", panel.metricName)}`,
        );
      const modelExpression =
        "if(span_attributes['gen_ai.response.model'] = '', span_attributes['gen_ai.request.model'], span_attributes['gen_ai.response.model'])";
      if (panel.source === "traces" && panel.model)
        where.push(
          `${modelExpression} = ${bindings.bindString("model", panel.model)}`,
        );
      if (panel.source === "traces" && panel.provider)
        where.push(
          `span_attributes['gen_ai.provider.name'] = ${bindings.bindString("provider", panel.provider)}`,
        );
      const tokenAttribute = (
        {
          input_tokens: "gen_ai.usage.input_tokens",
          output_tokens: "gen_ai.usage.output_tokens",
          total_tokens: "gen_ai.usage.total_tokens",
        } as Record<string, string>
      )[panel.measure];
      const tokenValue = tokenAttribute
        ? `toFloat64OrNull(span_attributes[${bindings.bindString("token_attribute", tokenAttribute)}])`
        : null;
      if (tokenValue) where.push(`${tokenValue} >= 0`);
      if (panel.visualization === "logs") {
        const result = await clickhouse.query({
          format: "JSONEachRow",
          query: `SELECT timestamp, service_name, severity_text, body FROM logs_raw WHERE ${where.join(" AND ")} ORDER BY timestamp DESC LIMIT 50`,
          query_params: bindings.query_params,
        });
        const rows = await result.json<{
          timestamp: string;
          service_name: string;
          severity_text: string;
          body: string;
        }>();
        return ok({
          ...empty,
          logs: rows.map((row) => ({
            time: normalizeDateTime(row.timestamp),
            service: row.service_name,
            severity: row.severity_text,
            message: row.body,
          })),
        });
      }
      const bucketCount = 60;
      const bucketMs = Math.max(
        1,
        Math.ceil((endAtUtc.getTime() - startAtUtc.getTime()) / bucketCount),
      );
      const groupExpression =
        panel.source === "traces" && panel.groupBy === "model"
          ? `if(${modelExpression} = '', 'Unknown model', ${modelExpression})`
          : panel.source === "traces" && panel.groupBy === "provider"
            ? "if(span_attributes['gen_ai.provider.name'] = '', 'Unknown provider', span_attributes['gen_ai.provider.name'])"
            : panel.groupBy === "host" && panel.source === "metrics"
              ? "if(host_name = '', 'Unknown host', host_name)"
              : panel.groupBy === "service"
                ? "if(service_name = '', 'Unknown service', service_name)"
                : "'All'";
      const numeric =
        panel.source === "traces"
          ? "duration_ns / 1000000"
          : "coalesce(value_double, toFloat64(value_int), histogram_sum)";
      const aggregate = panel.aggregation.startsWith("p")
        ? `quantile(${Number(panel.aggregation.slice(1)) / 100})(${numeric})`
        : `${panel.aggregation}(${numeric})`;
      const expression = tokenValue
        ? `sum(${tokenValue})`
        : panel.measure === "count"
          ? "count()"
          : panel.measure === "error_rate"
            ? `if(count() > 0, 100.0 * countIf(${panel.source === "traces" ? "status_code = 2" : "severity_number >= 17"}) / count(), 0)`
            : panel.source === "metrics" && panel.aggregation !== "sum"
              ? resolveAggregationExpression(panel.aggregation, bucketMs)
              : aggregate;
      const bucketExpression = `least(59, intDiv(toUnixTimestamp64Milli(${timeColumn}) - ${startAtUtc.getTime()}, ${bucketMs}))`;
      const [bucketResult, summaryResult] = await Promise.all([
        clickhouse.query({
          format: "JSONEachRow",
          query: `SELECT ${bucketExpression} AS bucket, ${groupExpression} AS name, ${expression} AS value FROM ${table} WHERE ${where.join(" AND ")} GROUP BY bucket, name ORDER BY bucket, name LIMIT 48000`,
          query_params: bindings.query_params,
        }),
        clickhouse.query({
          format: "JSONEachRow",
          query: `SELECT ${groupExpression} AS name, ${expression} AS value FROM ${table} WHERE ${where.join(" AND ")} GROUP BY name ORDER BY name LIMIT 8`,
          query_params: bindings.query_params,
        }),
      ]);
      const buckets = await bucketResult.json<{
        bucket: number;
        name: string;
        value: number | null;
      }>();
      const summaries = await summaryResult.json<{
        name: string;
        value: number | null;
      }>();
      const numberOrNull = (value: unknown) =>
        value === null || !Number.isFinite(Number(value))
          ? null
          : Number(value);
      return ok({
        ...empty,
        unit:
          panel.unit === "auto"
            ? tokenValue
              ? "tokens"
              : panel.measure === "duration"
                ? "ms"
                : panel.measure === "error_rate"
                  ? "%"
                  : ""
            : panel.unit,
        series: summaries.map((summary) => {
          const byBucket = new Map(
            buckets
              .filter((bucket) => bucket.name === summary.name)
              .map((bucket) => [Number(bucket.bucket), bucket.value]),
          );
          return {
            name: summary.name,
            value: numberOrNull(summary.value),
            buckets: Array.from({ length: bucketCount }, (_, index) => ({
              time: new Date(
                startAtUtc.getTime() + index * bucketMs,
              ).toISOString(),
              value: byBucket.has(index)
                ? numberOrNull(byBucket.get(index))
                : panel.measure === "count" || tokenValue
                  ? 0
                  : null,
            })),
          };
        }),
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "getPanelData: failed to query dashboard panel",
        error as Error,
      );
      return err("Failed to load panel data.");
    }
  };
export { createGetPanelData };
