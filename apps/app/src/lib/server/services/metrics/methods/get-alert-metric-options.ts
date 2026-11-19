import { getMetricAttributeColumns } from "../attribute-columns";
import { derivedMetrics } from "$lib/metric-definitions";
import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";
import { getAlertMetricOptionsInputSchema } from "../schema";
import { quote } from "../../shared/query-builders";

const createGetAlertMetricOptions =
  ({ clickhouse, logger }: { clickhouse: ClickHouse; logger: Logger }) =>
  async (
    input: z.input<typeof getAlertMetricOptionsInputSchema>,
    context: { appId: string },
  ) => {
    const validated = getAlertMetricOptionsInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);
    const { kind, metricName, attributeKey, query, limit } = validated.data;
    try {
      const columns = {
        metrics: "metric_name",
        services: "service_name",
        environments: "deployment_environment",
        scopes: "scope_name",
        containerNames: "container_name",
        attributeKeys: "arrayJoin(mapKeys(attributes))",
        attributeValues: `attributes[${quote(attributeKey ?? "")}]`,
      };
      const trace =
        kind !== "metrics" &&
        derivedMetrics.some((metric) => metric.name === metricName);
      const derived = derivedMetrics.find(
        (metric) => metric.name === metricName,
      );
      const table = trace ? "traces_raw" : "metrics_raw";
      const attributeColumns = getMetricAttributeColumns(trace);
      const attributes = `mapUpdate(resource_attributes, ${trace ? "span_attributes" : "attributes"})`;
      const knownKeys = Object.entries(attributeColumns).map(
        ([key, column]) => `if(${column} != '', ${quote(key)}, '')`,
      );
      columns.attributeKeys = `arrayJoin(arrayDistinct(arrayConcat(mapKeys(${attributes}), [${knownKeys.join(",")}])))`;
      columns.attributeValues =
        attributeColumns[attributeKey ?? ""] ??
        `${attributes}[${quote(attributeKey ?? "")}]`;
      if (trace) columns.containerNames = "''";
      const where = [
        `app_id = ${quote(context.appId)}`,
        ...(kind !== "metrics" && metricName && !derived
          ? [`metric_name = ${quote(metricName)}`]
          : []),
        ...(trace ? ["kind = 2"] : []),
      ];
      // Only expose names with a consistent gauge type and unit.
      const result = await clickhouse.query({
        format: "JSONEachRow",
        query:
          kind === "metrics"
            ? `
          SELECT metric_name AS value, count() AS count, any(metric_unit) AS unit, any(metric_type) AS type, any(is_monotonic) AS monotonic
          FROM metrics_raw WHERE ${where.join(" AND ")}
            AND positionCaseInsensitiveUTF8(metric_name, ${quote(query)}) > 0
          GROUP BY metric_name
          HAVING uniqExact(tuple(metric_type, metric_unit, is_monotonic)) = 1 AND any(metric_type) IN ('gauge','sum','histogram')
          ORDER BY value ASC LIMIT ${limit}
        `
            : `
          SELECT value, count() AS count, '' AS unit, '' AS type, 0 AS monotonic
          FROM (
            SELECT ${columns[kind]} AS value FROM ${table}
            WHERE ${where.join(" AND ")}
          )
          WHERE value != '' AND positionCaseInsensitiveUTF8(value, ${quote(query)}) > 0
          GROUP BY value ORDER BY count DESC, value ASC LIMIT ${limit}
        `,
      });
      const rows = (await result.json()) as unknown as {
        value: string;
        count: number | string;
        unit: string;
        type: string;
        monotonic: boolean | number;
      }[];
      const values = rows.map((row) => ({
        value: row.value,
        count: Number(row.count),
        unit: row.unit,
        type: row.type,
        isMonotonic: Boolean(row.monotonic),
      }));
      if (kind === "metrics") {
        for (const metric of derivedMetrics) {
          if (metric.name.toLowerCase().includes(query.toLowerCase())) {
            const index = values.findIndex(
              (option) => option.value === metric.name,
            );
            if (index >= 0) values.splice(index, 1);
            values.push({
              value: metric.name,
              unit: metric.unit,
              type: metric.type,
              isMonotonic: metric.isMonotonic,
              count: 0,
            });
          }
        }
      }
      return ok({
        values: values
          .sort((a, b) => a.value.localeCompare(b.value))
          .slice(0, limit),
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "getAlertMetricOptions: failed to load metric options",
        error as Error,
      );
      return err("Failed to load metric options.");
    }
  };

export { createGetAlertMetricOptions };
