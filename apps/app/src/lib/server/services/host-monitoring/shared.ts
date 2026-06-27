import type { DB } from "@repo/db";
import { ingestionKey } from "@repo/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toPercent = (value: number | string | null | undefined) => {
  const number = toNullableNumber(value);
  if (number === null) {
    return null;
  }

  return number * 100;
};

const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.includes("T") && !value.endsWith("Z") ? `${value}Z` : value;
};

const buildHostSeries = (
  rows: Array<{
    metric_name: string;
    bucket_index: number;
    value: number | string | null;
  }>,
  startAtUtc: Date,
  endAtUtc: Date,
  bucketCount: number,
  bucketSizeMs: number,
) => {
  const metricNames = [
    "system.cpu.utilization",
    "system.memory.utilization",
    "system.filesystem.utilization",
  ] as const;
  const labels: Record<(typeof metricNames)[number], string> = {
    "system.cpu.utilization": "CPU",
    "system.memory.utilization": "Memory",
    "system.filesystem.utilization": "Filesystem",
  };
  const rowMap = new Map(
    rows.map((row) => [`${row.metric_name}:${row.bucket_index}`, row]),
  );

  return metricNames.map((metricName) => {
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(startAtUtc.getTime() + index * bucketSizeMs);
      const bucketEnd = new Date(
        Math.min(
          startAtUtc.getTime() + (index + 1) * bucketSizeMs,
          endAtUtc.getTime(),
        ),
      );
      const row = rowMap.get(`${metricName}:${index}`);

      return {
        startAtUtc: bucketStart.toISOString(),
        endAtUtc: bucketEnd.toISOString(),
        value: toPercent(row?.value ?? null),
        points: row ? 1 : 0,
      };
    });

    return {
      key: metricName,
      label: labels[metricName],
      points: buckets.filter((bucket) => bucket.points > 0).length,
      buckets,
    };
  });
};

const shellQuote = (value: string) => `'${value.replaceAll(`'`, `'\"'\"'`)}'`;

const buildHostIncidentSourceKey = (
  hostId: string,
  type: "agent_disconnected" | "offline",
) => `host:${hostId}:${type}`;

const createGetPrivateIngestionKey = ({
  db,
}: {
  db: DB;
}) => async (appId: string) => {
  const key = await db.query.ingestionKey.findFirst({
    where: and(
      eq(ingestionKey.appId, appId),
      eq(ingestionKey.kind, "private"),
      isNull(ingestionKey.revokedAt),
    ),
    orderBy: [desc(ingestionKey.createdAt)],
  });

  return key?.key ?? null;
};

export {
  buildHostIncidentSourceKey,
  buildHostSeries,
  createGetPrivateIngestionKey,
  normalizeDateTime,
  shellQuote,
  toNullableNumber,
  toPercent,
};
