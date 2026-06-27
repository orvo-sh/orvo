import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { resolveTimeFilter } from "../../shared/time-filter";
import { getMetricsExplorerInputSchema } from "../schema";
import {
  buildMetricsWhereClause,
  buildSeries,
  normalizeDateTime,
  normalizeFacetRows,
  resolveAggregationExpression,
  resolveGroupExpression,
} from "../shared";

const createGetMetricsExplorer = ({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
}) => async (
  input: z.input<typeof getMetricsExplorerInputSchema>,
  context: { appId: string },
) => {
  const validated = getMetricsExplorerInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const timeRange = resolveTimeFilter(validated.data.time);
    const rangeMs = Math.max(
      timeRange.endAtUtc.getTime() - timeRange.startAtUtc.getTime(),
      1,
    );
    const bucketCount = validated.data.bucketCount;
    const bucketSizeMs = Math.max(Math.ceil(rangeMs / bucketCount), 1);
    const whereClause = buildMetricsWhereClause(context.appId, validated.data);
    const summaryWhereClause = buildMetricsWhereClause(context.appId, {
      ...validated.data,
      metricName: undefined,
    });
    const groupExpression = resolveGroupExpression(validated.data.groupBy);
    const aggregationExpression = resolveAggregationExpression(
      validated.data.aggregation,
      bucketSizeMs,
    );

    const [
      summaryResult,
      metricFacetsResult,
      serviceFacetsResult,
      environmentFacetsResult,
      hostFacetsResult,
      containerFacetsResult,
      entityKindFacetsResult,
      catalogResult,
      seriesResult,
      samplesResult,
    ] = await Promise.all([
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            count() AS total_points,
            uniqExact(metric_name) AS metric_count,
            uniqExactIf(service_name, service_name != '') AS service_count,
            uniqExactIf(deployment_environment, deployment_environment != '') AS environment_count,
            max(time) AS last_seen
          FROM metrics_raw
          WHERE ${summaryWhereClause}
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            metric_name AS value,
            count() AS count
          FROM metrics_raw
          WHERE ${summaryWhereClause}
          GROUP BY metric_name
          ORDER BY count DESC
          LIMIT 100
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            service_name AS value,
            count() AS count
          FROM metrics_raw
          WHERE ${summaryWhereClause}
            AND service_name != ''
          GROUP BY service_name
          ORDER BY count DESC
          LIMIT 50
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            deployment_environment AS value,
            count() AS count
          FROM metrics_raw
          WHERE ${summaryWhereClause}
            AND deployment_environment != ''
          GROUP BY deployment_environment
          ORDER BY count DESC
          LIMIT 50
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            if(host_name = '', host_id, host_name) AS value,
            count() AS count
          FROM metrics_raw
          WHERE ${summaryWhereClause}
            AND (host_name != '' OR host_id != '')
          GROUP BY value
          ORDER BY count DESC
          LIMIT 50
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            if(container_name = '', container_id, container_name) AS value,
            count() AS count
          FROM metrics_raw
          WHERE ${summaryWhereClause}
            AND (container_name != '' OR container_id != '')
          GROUP BY value
          ORDER BY count DESC
          LIMIT 50
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            entity_kind AS value,
            count() AS count
          FROM metrics_raw
          WHERE ${summaryWhereClause}
            AND entity_kind != ''
          GROUP BY entity_kind
          ORDER BY count DESC
          LIMIT 10
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            metric_name,
            any(metric_type) AS metric_type,
            any(metric_unit) AS metric_unit,
            any(description) AS description,
            count() AS points,
            uniqExactIf(service_name, service_name != '') AS services,
            uniqExactIf(host_id, host_id != '') AS hosts,
            uniqExactIf(container_id, container_id != '') AS containers,
            any(is_monotonic) AS is_monotonic,
            max(time) AS last_seen,
            argMax(coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)), time) AS last_value
          FROM metrics_raw
          WHERE ${summaryWhereClause}
          GROUP BY metric_name
          ORDER BY points DESC, last_seen DESC
          LIMIT 100
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          WITH
            ${timeRange.startAtUtc.getTime()} AS start_ms,
            ${bucketSizeMs} AS bucket_ms
          SELECT
            least(toInt32(intDiv(toUnixTimestamp64Milli(time) - start_ms, bucket_ms)), ${bucketCount - 1}) AS bucket_index,
            ${groupExpression} AS group_key,
            ${aggregationExpression} AS value,
            count() AS points
          FROM metrics_raw
          WHERE ${whereClause}
          GROUP BY bucket_index, group_key
          ORDER BY bucket_index ASC, points DESC
        `,
      }),
      clickhouse.query({
        format: "JSONEachRow",
        query: `
          SELECT
            metric_name,
            metric_type,
            metric_unit,
            service_name,
            deployment_environment,
            host_name,
            host_id,
            container_name,
            container_id,
            entity_kind,
            time,
            coalesce(value_double, toFloat64(value_int), histogram_sum, toFloat64(histogram_count)) AS value
          FROM metrics_raw
          WHERE ${whereClause}
          ORDER BY time DESC, id DESC
          LIMIT ${validated.data.sampleLimit}
        `,
      }),
    ]);

    const summaryRows = (await summaryResult.json()) as unknown as Array<{
      total_points: number | string;
      metric_count: number | string;
      service_count: number | string;
      environment_count: number | string;
      last_seen: string | Date;
    }>;
    const metricFacetRows = (await metricFacetsResult.json()) as unknown as Array<{
      value: string;
      count: number | string;
    }>;
    const serviceFacetRows = (await serviceFacetsResult.json()) as unknown as Array<{
      value: string;
      count: number | string;
    }>;
    const environmentFacetRows =
      (await environmentFacetsResult.json()) as unknown as Array<{
        value: string;
        count: number | string;
      }>;
    const hostFacetRows = (await hostFacetsResult.json()) as unknown as Array<{
      value: string;
      count: number | string;
    }>;
    const containerFacetRows =
      (await containerFacetsResult.json()) as unknown as Array<{
        value: string;
        count: number | string;
      }>;
    const entityKindFacetRows =
      (await entityKindFacetsResult.json()) as unknown as Array<{
        value: string;
        count: number | string;
      }>;
    const catalogRows = (await catalogResult.json()) as unknown as Array<{
      metric_name: string;
      metric_type: string;
      metric_unit: string;
      description: string;
      points: number | string;
      services: number | string;
      hosts: number | string;
      containers: number | string;
      is_monotonic: boolean | number;
      last_seen: string | Date;
      last_value: number | string | null;
    }>;
    const seriesRows = (await seriesResult.json()) as unknown as Array<{
      bucket_index: number;
      group_key: string;
      value: number | string | null;
      points: number | string;
    }>;
    const sampleRows = (await samplesResult.json()) as unknown as Array<{
      metric_name: string;
      metric_type: string;
      metric_unit: string;
      service_name: string;
      deployment_environment: string;
      host_name: string;
      host_id: string;
      container_name: string;
      container_id: string;
      entity_kind: string;
      time: string | Date;
      value: number | string | null;
    }>;

    const summary = summaryRows[0];

    return ok({
      summary: {
        totalPoints: Number(summary?.total_points ?? 0),
        metricCount: Number(summary?.metric_count ?? 0),
        serviceCount: Number(summary?.service_count ?? 0),
        environmentCount: Number(summary?.environment_count ?? 0),
        lastSeen: summary?.last_seen ? normalizeDateTime(summary.last_seen) : null,
      },
      facets: {
        metrics: normalizeFacetRows(metricFacetRows),
        services: normalizeFacetRows(serviceFacetRows),
        environments: normalizeFacetRows(environmentFacetRows),
        hosts: normalizeFacetRows(hostFacetRows),
        containers: normalizeFacetRows(containerFacetRows),
        entityKinds: normalizeFacetRows(entityKindFacetRows),
      },
      catalog: catalogRows.map((row) => ({
        name: row.metric_name,
        type: row.metric_type,
        unit: row.metric_unit,
        description: row.description,
        points: Number(row.points),
        services: Number(row.services),
        hosts: Number(row.hosts),
        containers: Number(row.containers),
        isMonotonic: Boolean(row.is_monotonic),
        lastSeen: normalizeDateTime(row.last_seen),
        lastValue: row.last_value === null ? null : Number(row.last_value),
      })),
      series: buildSeries(seriesRows, {
        bucketCount,
        bucketSizeMs,
        startAtUtc: timeRange.startAtUtc,
        endAtUtc: timeRange.endAtUtc,
      }),
      samples: sampleRows.map((row) => ({
        metricName: row.metric_name,
        type: row.metric_type,
        unit: row.metric_unit,
        serviceName: row.service_name,
        environment: row.deployment_environment,
        hostName: row.host_name || row.host_id,
        containerName: row.container_name || row.container_id,
        entityKind: row.entity_kind || "application",
        time: normalizeDateTime(row.time),
        value: row.value === null ? null : Number(row.value),
      })),
      startAtUtc: timeRange.startAtUtc.toISOString(),
      endAtUtc: timeRange.endAtUtc.toISOString(),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to fetch metrics", error as Error);
    return err("Failed to fetch metrics.");
  }
};

export { createGetMetricsExplorer };
