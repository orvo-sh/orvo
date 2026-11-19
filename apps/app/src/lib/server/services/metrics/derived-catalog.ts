import type { ClickHouse } from "@repo/clickhouse";
import { derivedMetrics } from "$lib/metric-definitions";
import {
  normalizeDateTime,
  quote,
  toDateTime64,
} from "../shared/query-builders";

const getDerivedMetricCatalog = async (
  clickhouse: ClickHouse,
  appId: string,
  start: Date,
  end: Date,
) => {
  const result = await clickhouse.query({
    format: "JSONEachRow",
    query: `SELECT count() AS points, uniqExactIf(service_name, service_name != '') AS services, maxOrNull(start_time) AS last_seen FROM traces_raw WHERE app_id = ${quote(appId)} AND start_time >= ${toDateTime64(start)} AND start_time < ${toDateTime64(end)} AND kind = 2`,
  });
  const [row] = (await result.json()) as unknown as {
    points: number | string;
    services: number | string;
    last_seen: string | null;
  }[];
  return derivedMetrics.map((metric) => {
    return {
      name: metric.name,
      type: metric.type,
      unit: metric.unit,
      description: metric.description,
      isMonotonic: Boolean(metric.isMonotonic),
      points: Number(row?.points ?? 0),
      services: Number(row?.services ?? 0),
      containers: 0,
      lastSeen: row?.last_seen ? normalizeDateTime(row.last_seen) : "",
      lastValue: null as number | null,
    };
  });
};

export { getDerivedMetricCatalog };
